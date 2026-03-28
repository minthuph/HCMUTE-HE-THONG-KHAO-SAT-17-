// ==========================================
// 1. CẤU HÌNH FIREBASE - ĐÃ TÍCH HỢP MÃ CỦA HẢI
// ==========================================
console.log('Script loaded');
const firebaseConfig = {
  apiKey: "AIzaSyBR6z73JSpH1ASk5miurP7D11jAUe0dC3w",
  authDomain: "hcmute-survey-d9adf.firebaseapp.com",
  // Dòng này cực kỳ quan trọng để máy 2 thấy máy 1:
  databaseURL: "https://hcmute-survey-d9adf-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hcmute-survey-d9adf",
  storageBucket: "hcmute-survey-d9adf.firebasestorage.app",
  messagingSenderId: "186143325355",
  appId: "1:186143325355:web:6c34d2ab4f401fe659cbee",
  measurementId: "G-BYL6BZQY8D"
};

// Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
const chatRef = db.ref('chatMessages');

function escapeHtml(text) {
    return text.replace(/[&<>"]+/g, (match) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;'
    })[match]);
}

function formatChatTime(timestamp) {
    const date = new Date(timestamp);
    if (isNaN(date)) return '';
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function renderChatMessages(messages = []) {
    const chatWindow = document.getElementById('chat-window');
    if (!chatWindow) return;

    if (!messages.length) {
        chatWindow.innerHTML = '<div class="chat-empty">Chưa có tin nhắn nào. Bạn hãy mở đầu cuộc trò chuyện nhé!</div>';
        chatWindow.scrollTop = chatWindow.scrollHeight;
        return;
    }

    chatWindow.innerHTML = messages.map(message => {
        const isSelf = message.user === currentUser;
        return `
            <div class="chat-message ${isSelf ? 'chat-message-self' : ''}">
                <div class="chat-message-user">${escapeHtml(message.user)}${isSelf ? ' (Bạn)' : ''}</div>
                <div class="chat-message-text">${escapeHtml(message.text)}</div>
                <div class="chat-message-time">${formatChatTime(message.time)}</div>
            </div>
        `;
    }).join('');

    chatWindow.scrollTop = chatWindow.scrollHeight;
}

function sendChatMessage() {
    const chatInput = document.getElementById('chat-input');
    if (!chatInput) return;

    const text = chatInput.value.trim();
    if (!text) return;

    if (!currentUser) {
        alert('Vui lòng đăng nhập để gửi tin nhắn.');
        return;
    }

    chatRef.push({
        user: currentUser,
        text,
        time: new Date().toISOString()
    });

    chatInput.value = '';
}

function initChat() {
    const sendButton = document.getElementById('chat-send-btn');
    const chatInput = document.getElementById('chat-input');

    if (sendButton) sendButton.addEventListener('click', sendChatMessage);
    if (chatInput) chatInput.addEventListener('keypress', event => {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendChatMessage();
        }
    });
}

chatRef.limitToLast(100).on('value', snapshot => {
    const data = snapshot.val();
    const messages = data ? Object.values(data).sort((a, b) => a.time.localeCompare(b.time)) : [];
    renderChatMessages(messages);
});

// ==========================================
// CAROUSEL - TRANG CHỦ ĐẦU TIÊN
// ==========================================
let currentSlideIndex = 0;
const SLIDE_INTERVAL = 5000; // 5 giây

function showSlide(n) {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    
    if (n >= slides.length) { currentSlideIndex = 0; }
    if (n < 0) { currentSlideIndex = slides.length - 1; }
    
    slides.forEach(slide => slide.classList.remove('active'));
    dots.forEach(dot => dot.classList.remove('active'));
    
    if (slides[currentSlideIndex]) {
        slides[currentSlideIndex].classList.add('active');
        dots[currentSlideIndex].classList.add('active');
    }
}

function nextSlide() {
    showSlide(++currentSlideIndex);
}

function prevSlide() {
    showSlide(--currentSlideIndex);
}

function currentSlide(n) {
    currentSlideIndex = n;
    showSlide(currentSlideIndex);
}

// Auto advance carousel
let carouselInterval = setInterval(nextSlide, SLIDE_INTERVAL);

// Reset carousel timer when user clicks
document.addEventListener('click', (e) => {
    if (e.target.closest('.carousel-banner')) {
        clearInterval(carouselInterval);
        carouselInterval = setInterval(nextSlide, SLIDE_INTERVAL);
    }
});

// =========================================
// 2. BIẾN TOÀN CỤC - ĐÃ CẬP NHẬT ĐỂ LƯU NHIỀU TIẾN ĐỘ
// ==========================================
const ADMIN_USER = "admin";
let currentUser = localStorage.getItem('currentUser') || null;

// Thay đổi dòng này: Tạo kho lưu trữ tất cả tiến độ khảo sát theo từng môn
let allSurveysProgress = currentUser ? JSON.parse(localStorage.getItem(`allSurveysProgress_${currentUser}`)) || {} : {}; 

// Thêm kho lưu trữ trạng thái đã submit khảo sát
let submittedSurveys = currentUser ? JSON.parse(localStorage.getItem(`submittedSurveys_${currentUser}`)) || {} : {};

let currentTopic = ""; // Chủ đề hiện tại đang chọn
let leaderboard = [];
let surveyResponses = [];
let activeSurvey = currentUser ? localStorage.getItem(`activeSurvey_${currentUser}`) : null;

// ==========================================
// 3. ĐỒNG BỘ ONLINE REALTIME (MÁY 1 NHẬP - MÁY 2 THẤY)
// ==========================================
db.ref('data').on('value', (snapshot) => {
    const data = snapshot.val();
    if (data) {
        leaderboard = data.leaderboard || [];
        surveyResponses = data.surveyResponses || [];
        
        // Tự động cập nhật giao diện khi có thay đổi trên Cloud
        updateLeaderboard();
        updateAsideProfile();
        if (currentUser === ADMIN_USER) updateAdminStats();
    }
});

function syncDatabase() {
    db.ref('data').set({
        leaderboard: leaderboard,
        surveyResponses: surveyResponses
    });
    if(currentUser) localStorage.setItem('currentUser', currentUser);
}

// ==========================================
// 4. HỆ THỐNG VÀ ĐĂNG NHẬP
// ==========================================
window.addEventListener('load', () => {
    if(currentUser) {
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        checkAdminAccess();
        if(currentSurvey) restoreSurvey();
        updateSurveyProgressBar(); // Cập nhật trạng thái hoàn thành sau khi load
        initChat();
    }
});

document.addEventListener('DOMContentLoaded', initChat);

document.getElementById('login-btn').addEventListener('click', () => {
    console.log('Login button clicked');
    const username = document.getElementById('username-input').value.trim();
    const password = document.getElementById('password-input').value.trim();
    const errorMsg = document.getElementById('login-error');

    if (!username || !password) {
        errorMsg.innerText = "Vui lòng nhập đầy đủ MSSV và Mật khẩu!";
        return;
    }

    if (password === username + "@123" || (username === "admin" && password === "admin@123")) {
        console.log('Login successful for:', username);
        currentUser = username;
        
        // Load dữ liệu khảo sát của user này
        allSurveysProgress = JSON.parse(localStorage.getItem(`allSurveysProgress_${currentUser}`)) || {};
        submittedSurveys = JSON.parse(localStorage.getItem(`submittedSurveys_${currentUser}`)) || {};
        activeSurvey = localStorage.getItem(`activeSurvey_${currentUser}`) || null;
        
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        // Nếu user mới, thêm vào bảng xếp hạng online
        if(username !== ADMIN_USER && !leaderboard.find(u => u.mssv === username)) {
            leaderboard.push({ mssv: username, exp: 0 });
            syncDatabase();
        }
        
        localStorage.setItem('currentUser', currentUser);
        checkAdminAccess();
        
        // Cập nhật UI khảo sát dựa trên dữ liệu đã lưu
        setTimeout(() => {
            updateSurveyProgressBar();
            updateAsideProfile();
            updateLeaderboard();
        }, 100);
    } else {
        console.log('Login failed');
        errorMsg.innerText = "Sai tài khoản hoặc mật khẩu!";
    }
});

document.getElementById('logout-btn').addEventListener('click', () => {
    // Xóa trạng thái active của user hiện tại trước khi logout
    // NHƯNG GIỮ lại dữ liệu khảo sát để restore sau khi login lại
    if (currentUser) {
        localStorage.removeItem(`activeSurvey_${currentUser}`);
        // KHÔNG xóa allSurveysProgress và submittedSurveys - để restore sau
    }
    
    currentUser = null;
    activeSurvey = null;
    allSurveysProgress = {};
    submittedSurveys = {};
    
    localStorage.removeItem('currentUser');
    location.reload(); 
});

// ==========================================
// 5. CHỨC NĂNG KHẢO SÁT
// ==========================================
const surveyQuestionsData = {
    'Cơ sở vật chất': [
        { text: "Bạn thường xuyên 'cắm cọc' học tập tại khu vực nào nhất?", type: "datalist", options: ["Tòa nhà Trung tâm", "Khu A (Cũ nhưng chất)", "Khu B", "Khu C (Huyền thoại)", "Khu D", "Khu E (Vọc vạch)", "Khu F", "Xưởng thực hành"] },
        { text: "Những 'nỗi khổ' bạn thường xuyên gặp phải? (Chọn nhiều)", type: "multi-check", options: ["Wifi 'lúc có lúc không'", "Kẹt thang máy tòa Trung tâm", "Máy lạnh khu C/E hoạt động kém", "Nhà vệ sinh quá tải/không sạch", "Hết chỗ gửi xe giờ cao điểm", "Ổ cắm điện bị hỏng/thiếu"] },
        { text: "Độ 'mượt' của thang máy tòa nhà Trung tâm vào giờ cao điểm?", type: "emoji-rating", options: [{ value: 1, emoji: "😫", label: "Đợi cả thanh xuân" }, { value: 2, emoji: "😒", label: "Rất lâu" }, { value: 3, emoji: "😐", label: "Bình thường" }, { value: 4, emoji: "🙂", label: "Tạm ổn" }, { value: 5, emoji: "🚀", label: "Rất nhanh" }] },
        { text: "Chất lượng bàn ghế và không gian tại các phòng lý thuyết?", type: "radio", options: ["Hiện đại/Sạch sẽ", "Ổn trong tầm giá", "Hơi cũ nhưng dùng được", "Cần thanh lý gấp"] },
        { text: "Bạn đánh giá độ phủ sóng Wifi của trường ở mức mấy sao?", type: "star-rating", maxStars: 5 },
        { text: "Mức độ hài lòng về hệ thống bãi giữ xe của trường?", type: "slider", min: 0, max: 100, step: 1 },
        { text: "Hệ thống âm thanh/máy chiếu có gây gián đoạn buổi học không?", type: "radio", options: ["Luôn ổn định", "Thỉnh thoảng lỗi", "Hay bị lỗi kết nối", "Rất tệ"] },
        { text: "Cảnh quan và không gian xanh (ghế đá, sân trường) để nghỉ ngơi?", type: "radio",options: ["Tuyệt vời", "Tốt", "Cũng bình thường", "Kém"] },
        { text: "Bạn đánh giá tổng thể diện mạo UTE so với các trường khác?", type: "emoji-rating", options: [{ value: 1, emoji: "💩", label: "Thua xa" }, { value: 2, emoji: "😟", label: "Hơi cũ" }, { value: 3, emoji: "😐", label: "Ngang bằng" }, { value: 4, emoji: "✨", label: "Khá đẹp" }, { value: 5, emoji: "🔥", label: "Xịn nhất Thủ Đức" }] },
        { text: "Bạn muốn trường ưu tiên sửa chữa/nâng cấp khu vực nào nhất?", type: "textarea", placeholder: "Ví dụ: Nhà vệ sinh khu B, Thêm máy lạnh khu E..." }
    ],
    'Chất lượng giảng viên': [
        { text: "Giảng viên của bạn có thường xuyên sử dụng LMS/UTEx không?", type: "radio", options: ["Rất tích cực", "Có sử dụng", "Ít khi", "Không bao giờ"] },
        { text: "Thái độ của thầy cô đối với các câu hỏi 'ngây ngô' của sinh viên?", type: "emoji-rating", options: [{ value: 1, emoji: "😤", label: "Gắt gỏng" }, { value: 2, emoji: "🤨", label: "Hơi khó tính" }, { value: 3, emoji: "😐", label: "Bình thường" }, { value: 4, emoji: "🙂", label: "Nhiệt tình" }, { value: 5, emoji: "❤️", label: "Rất tận tâm" }] },
        { text: "Bạn thích phong cách giảng dạy nào nhất?", type: "datalist", options: ["Thực hành thực tế", "Lý thuyết chuyên sâu", "Vừa học vừa chơi/Game", "Giải bài tập liên tục"] },
        { text: "Những điểm cộng của giảng viên UTE trong mắt bạn? (Chọn nhiều)", type: "multi-check", options: ["Kiến thức thực tế cực giỏi", "Thương sinh viên", "Chấm điểm công bằng", "Hỗ trợ ngoài giờ tận tình", "Hài hước, giảm stress"] },
        { text: "Độ khó của các bài kiểm tra/thi so với kiến thức trên lớp?", type: "star-rating", maxStars: 5 },
        { text: "Khả năng truyền cảm hứng và định hướng nghề nghiệp của thầy cô?", type: "slider", min: 0, max: 100, step: 1 },
        { text: "Giảng viên có cập nhật các công nghệ/xu hướng mới vào bài giảng không?", type: "radio", options: ["Luôn cập nhật", "Có cập nhật", "Hầu như không", "Lạc hậu"] },
        { text: "Mức độ 'ám ảnh' của bạn đối với việc bị check-in/điểm danh?", type: "star-rating", maxStars: 5 },
        { text: "Bạn đánh giá mức độ chuyên nghiệp của bộ phận Giáo vụ khoa?", type: "emoji-rating", options: [{ value: 1, emoji: "🙄", label: "Khó gần" }, { value: 2, emoji: "😟", label: "Chưa hỗ trợ tốt" }, { value: 3, emoji: "😐", label: "Bình thường" }, { value: 4, emoji: "😊", label: "Hỗ trợ tốt" }, { value: 5, emoji: "🥰", label: "Tuyệt vời" }] },
        { text: "Gửi một lời nhắn nhủ chân thành đến quý Thầy/Cô...", type: "textarea", placeholder: "Chia sẻ tâm tư của bạn..." }
    ],
    'Khu vực thư viện': [
        { text: "Mục đích chính bạn vào thư viện là gì?", type: "datalist", options: ["Mượn/Trả sách", "Ngủ máy lạnh", "Học nhóm", "Sống ảo/Check-in", "Xài ké PC/Wifi"] },
        { text: "Độ 'mát mẻ' của máy lạnh thư viện (tầng 2 khu A và tầng hầm)?", type: "emoji-rating", options: [{ value: 1, emoji: "🥵", label: "Nóng" }, { value: 2, emoji: "⛅", label: "Hơi ấm" }, { value: 3, emoji: "🍃", label: "Vừa đủ" }, { value: 4, emoji: "❄️", label: "Mát rượi" }, { value: 5, emoji: "🥶", label: "Đóng băng" }] },
        { text: "Bạn đánh giá kho tài liệu số (E-book) của trường như thế nào?", type: "star-rating", maxStars: 5 },
        { text: "Những tiện ích bạn hài lòng nhất tại thư viện? (Chọn nhiều)", type: "multi-check", options: ["Phòng học nhóm riêng tư", "Khu vực ghế lười", "Máy tính tra cứu nhanh", "Thái độ nhân viên nhẹ nhàng", "Không gian yên tĩnh tuyệt đối"] },
        { text: "Tình trạng 'giữ chỗ' nhưng không có người ngồi tại thư viện?", type: "radio", options: ["Rất phổ biến/Khó chịu", "Thỉnh thoảng thấy", "Hiếm khi", "Không quan tâm"] },
        { text: "Mức độ hài lòng về quy trình mượn/trả sách tự động?", type: "slider", min: 0, max: 100, step: 1 },
        { text: "Hệ thống đèn chiếu sáng tại các khu tự học?", type: "star-rating", maxStars: 5 },
        { text: "Thái độ hỗ trợ của các anh/chị thủ thư?", type: "emoji-rating", options: [{ value: 1, emoji: "😡", label: "Khó chịu" }, { value: 2, emoji: "😕", label: "Hơi thờ ơ" }, { value: 3, emoji: "😐", label: "Bình thường" }, { value: 4, emoji: "🙂", label: "Nhiệt tình" }, { value: 5, emoji: "😇", label: "Cực kỳ thân thiện" }] },
        { text: "Bạn có thấy thư viện mở cửa đủ thời gian cho nhu cầu của mình?", type: "radio", options: ["Cần mở 24/7", "Đã đủ", "Nên mở thêm cuối tuần", "Nên đóng cửa muộn hơn"] },
        { text: "Đề xuất thêm tiện ích cho thư viện (Ví dụ: Thêm ổ cắm, cafe...)", type: "textarea", placeholder: "Ý tưởng của bạn là..." }
    ],
    'Khu vực ăn uống': [
        { text: "Bạn thường ăn trưa ở đâu?", type: "datalist", options: ["Căng tin Thành Đạt", "Căng tin KTX D1", "Cơm tiệm cổng trước/sau trường", "Ghé quán Cafe/Circle K", "Mang cơm nhà"] },
        { text: "Mức giá trung bình một bữa ăn tại trường có phù hợp túi tiền SV?", type: "emoji-rating", options: [{ value: 1, emoji: "💸", label: "Quá đắt" }, { value: 2, emoji: "😟", label: "Hơi cao" }, { value: 3, emoji: "👌", label: "Hợp lý" }, { value: 4, emoji: "🥗", label: "Rẻ", value: 5, emoji: "🥰", label: "Rất hời" }] },
        { text: "Chất lượng vệ sinh an toàn thực phẩm theo cảm nhận của bạn?", type: "star-rating", maxStars: 5 },
        { text: "Bạn mong muốn căng tin bán thêm món gì? (Chọn nhiều)", type: "multi-check", options: ["Đồ ăn healthy/Eat clean", "Nước ép/Trà sữa", "Thức ăn nhanh (Fastfood)", "Món đặc sản vùng miền", "Bánh mì/Đồ ăn nhẹ",{ label: "Khác", isInput: true, placeholder: "Nhập món bạn muốn..." } ] },
        { text: "Tốc độ phục vụ vào giờ cao điểm (11h-12h)?", type: "radio", options: ["Nhanh chóng", "Chờ chút xíu", "Đợi khá lâu", "Quá chậm/Hết món"] },
        { text: "Không gian chỗ ngồi tại căng tin như thế nào?", type: "star-rating", maxStars: 5 },
        { text: "Độ đa dạng của thực đơn hàng ngày?", type: "slider", min: 0, max: 100, step: 1 },
        { text: "Thái độ của nhân viên bán hàng/phục vụ?", type: "emoji-rating", options: [{ value: 1, emoji: "😤", label: "Khó chịu" }, { value: 2, emoji: "😒", label: "Lạnh lùng" }, { value: 3, emoji: "😐", label: "Bình thường" }, { value: 4, emoji: "😊", label: "Vui vẻ" }, { value: 5, emoji: "😍", label: "Rất nồng hậu" }] },
        { text: "Bạn có hài lòng với hình thức thanh toán (Tiền mặt/Chuyển khoản)?", type: "radio", options: ["Rất tiện", "Bình thường", "Bất tiện/Nên thêm mã QR"] },
        { text: "Góp ý để cải thiện trải nghiệm ăn uống tại UTE", type: "textarea", placeholder: "Góp ý của bạn..." }
    ]
};

function startSurvey(topic) {
    currentTopic = topic;
    
    // Nếu môn này chưa bao giờ làm, tạo một ngăn chứa mới trong kho
    if (!allSurveysProgress[topic]) {
        allSurveysProgress[topic] = { answers: {} };
    }

    // Ẩn danh sách, hiện bảng câu hỏi
    document.getElementById('survey-categories').style.display = 'none';
    document.getElementById('active-survey').style.display = 'block';
    document.getElementById('survey-title').innerText = `Khảo sát: ${topic}`;
    
    // Vẽ câu hỏi ra màn hình
    renderQuestions();
    
    // KHÔI PHỤC TIẾN ĐỘ CŨ (Tự động tích lại các ô đã chọn)
    setTimeout(() => {
        const savedAnswers = allSurveysProgress[topic].answers;
        restoreSurveyAnswers(savedAnswers);
        updateProgress(); // Cập nhật lại thanh màu xanh dựa trên số câu đã tích
    }, 50);
}
function restoreSurveyAnswers(savedAnswers) {
    const questions = document.querySelectorAll('.question-item');
    
    questions.forEach((q, index) => {
        const qNum = index + 1;
        const savedValue = savedAnswers[`q${qNum}`];
        
        if (!savedValue) return;
        
        // Restore emoji-rating
        const emojiOption = q.querySelector(`.emoji-option[data-value="${savedValue}"]`);
        if (emojiOption) {
            emojiOption.classList.add('active');
            return;
        }
        
        // Restore star-rating
        const starContainer = q.querySelector('.star-rating');
        if (starContainer) {
            const value = parseInt(savedValue);
            starContainer.querySelectorAll('.star').forEach((star, i) => {
                if (i < value) {
                    star.classList.add('active');
                } else {
                    star.classList.remove('active');
                }
            });
            return;
        }
        
        // Restore multi-check
        const checkboxes = q.querySelectorAll('input[type="checkbox"]');
        if (checkboxes.length > 0) {
            const selectedItems = savedValue.split(', ');
            checkboxes.forEach(cb => {
               if (selectedItems.includes(cb.value)) {
                    cb.checked = true;
                    if (cb.value === 'Khác') {
                        const input = q.querySelector(`#${cb.id}_input`);
                        if (input) input.style.display = 'block';
                    }
                }
            });
            // Handle custom input for "Khác"
            const customValue = selectedItems.find(item => item.startsWith('Khác: '));
            if (customValue) {
                const khacCb = Array.from(checkboxes).find(cb => cb.value === 'Khác');
                if (khacCb && !khacCb.checked) {
                    khacCb.checked = true;
                    const input = q.querySelector(`#${khacCb.id}_input`);
                    if (input) {
                        input.style.display = 'block';
                        input.value = customValue.substring(6).trim();
                    }
                }
            }
            return;
        }
        
        // Restore slider
        const slider = q.querySelector('input[type="range"]');
        if (slider) {
            slider.value = savedValue;
            slider.nextElementSibling.textContent = savedValue + '%';
            return;
        }
        
        // Restore textarea
        const textarea = q.querySelector('textarea');
        if (textarea) {
            textarea.value = savedValue;
            return;
        }
        
        // Restore datalist (select)
        const datalist = q.querySelector('select');
        if (datalist) {
            datalist.value = savedValue;
            return;
        }
        
        // Restore radio button
        const radio = q.querySelector(`input[type="radio"][value="${savedValue}"]`);
        if (radio) {
            radio.checked = true;
        }
    });
}

function renderQuestions() {
    const container = document.getElementById('question-container');
    container.innerHTML = '';
    const questions = surveyQuestionsData[currentTopic] || [];
    questions.forEach((questionData, index) => {
        const qDiv = document.createElement('div');
        qDiv.className = 'question-item';
         // Xử lý các loại câu hỏi khác nhau
        if (typeof questionData === 'string') {
            // Loại cũ: simple radio
            qDiv.innerHTML = `<h4>Câu ${index+1}: ${questionData}</h4><div class="options">
                <label><input type="radio" name="q${index+1}" value="10" onchange="updateProgress()"> Rất tốt</label>
                <label><input type="radio" name="q${index+1}" value="8" onchange="updateProgress()"> Tốt</label>
                <label><input type="radio" name="q${index+1}" value="5" onchange="updateProgress()"> Bình thường</label>
                <label><input type="radio" name="q${index+1}" value="2" onchange="updateProgress()"> Kém</label></div>`;
        } else {
            // Loại mới: object với type
            const qNum = index + 1;
            qDiv.innerHTML = `<h4>Câu ${qNum}: ${questionData.text}</h4>`;
            
            if (questionData.type === 'emoji-rating') {
                const optionsHtml = questionData.options.map((opt, i) => `
                    <button type="button" class="emoji-option" data-value="${opt.value}" data-qindex="${index}" onclick="selectEmojiRating(this, '${opt.value}', ${index})">
                        <span class="emoji-icon">${opt.emoji}</span>
                        <span class="emoji-label">${opt.label}</span>
                    </button>
                `).join('');
                qDiv.innerHTML += `<div class="emoji-rating">${optionsHtml}</div>`;
            } 
            else if (questionData.type === 'star-rating') {
                const starsHtml = Array.from({length: questionData.maxStars}, (_, i) => `
                    <span class="star" data-value="${i+1}" data-qindex="${index}" onclick="selectStar(this, ${i+1}, ${index})">★</span>
                `).join('');
                qDiv.innerHTML += `<div class="star-rating">${starsHtml}</div>`;
            }
            else if (questionData.type === 'multi-check') {
                const checkboxHtml = questionData.options.map((opt, i) => {
                    if (typeof opt === 'string') {
                        return `<label class="checkbox-label">
                            <input type="checkbox" name="q${index+1}_${i}" value="${opt}" onchange="updateProgress()">
                            <span>${opt}</span>
                        </label>`;
                    } else {
                        const checkboxId = `q${index+1}_${i}`;
                        return `<label class="checkbox-label">
                            <input type="checkbox" id="${checkboxId}" name="${checkboxId}" value="${opt.label}" onchange="toggleInput(this, '${checkboxId}_input'); updateProgress()">
                            <span>Khác: </span>
                            <input type="text" id="${checkboxId}_input" class="other-input" placeholder="${opt.placeholder}" style="display: none; margin-left: 5px;" onchange="updateProgress()">
                        </label>`;
                    }
                }).join('');
                qDiv.innerHTML += `<div class="multi-check">${checkboxHtml}</div>`;
            }
            else if (questionData.type === 'slider') {
                qDiv.innerHTML += `
                    <div class="slider-container">
                        <input type="range" class="slider" name="q${index+1}" min="${questionData.min}" max="${questionData.max}" step="${questionData.step}" onchange="updateProgress(); updateSliderValue(this)">
                        <span class="slider-value">50%</span>
                    </div>
                `;
            }
            else if (questionData.type === 'textarea') {
                qDiv.innerHTML += ` 
                <textarea name="q${index+1}" class="textarea-input" placeholder="${questionData.placeholder}" onchange="updateProgress()"></textarea>
                `;
            }
            else if (questionData.type === 'datalist') {
                const optionsHtml = questionData.options.map((opt, i) => `
                    <option value="${opt}">${opt}</option>
                `).join('');
                qDiv.innerHTML += `
                    <select name="q${index+1}" class="datalist-input" onchange="updateProgress()">
                        <option value="">-- Chọn một đáp án --</option>
                        ${optionsHtml}
                    </select>
                `;
            }
            else if (questionData.type === 'radio') {
                const radioHtml = questionData.options.map((opt, i) => `
                    <label><input type="radio" name="q${index+1}" value="${opt}" onchange="updateProgress()"> ${opt}</label>
                `).join('');
                qDiv.innerHTML += `<div class="options">${radioHtml}</div>`;
            }
        }
        container.appendChild(qDiv);
    });
}
function selectEmojiRating(element, value, qIndex) {
    const container = element.parentElement;
    container.querySelectorAll('.emoji-option').forEach(opt => opt.classList.remove('active'));
    element.classList.add('active');
    updateProgress();
}

function selectStar(element, value, qIndex) {
    const container = element.parentElement;
    container.querySelectorAll('.star').forEach((star, i) => {
        if (i < value) {
            star.classList.add('active');
        } else {
            star.classList.remove('active');
        }
    });
    // Lưu giá trị
    const qIndex_real = qIndex;
    allSurveysProgress[currentTopic].answers[`q${qIndex_real+1}`] = value * 2; // Convert to 2-10 scale
    updateProgress();
}

function updateSliderValue(slider) {
    const value = slider.value;
    slider.nextElementSibling.textContent = value + '%';
}
function toggleInput(checkbox, inputId) {
    const input = document.getElementById(inputId);
    input.style.display = checkbox.checked ? 'block' : 'none';
}

function updateProgress() {
    const questions = document.querySelectorAll('.question-item');
    let answered = 0;
    const totalQuestions = questions.length;

    questions.forEach((q, index) => {
        const hasAnswer = checkQuestionAnswered(q, index);
        if (hasAnswer) {
            answered++;
           
        }
    });

    // Lưu kho tiến độ vào bộ nhớ trình duyệt ngay lập tức (theo user)
    if (currentUser) {
        localStorage.setItem(`allSurveysProgress_${currentUser}`, JSON.stringify(allSurveysProgress));
    }

    // Cập nhật thanh xanh
    const percent = (answered / totalQuestions) * 100;
    document.getElementById('survey-progress').style.width = percent + '%';
    
    // Hiện nút Hoàn thành nếu đã làm xong tất cả câu
    document.getElementById('submit-survey-btn').style.display = answered === totalQuestions ? 'block' : 'none';
}

function checkQuestionAnswered(questionElement, index) {
    // Check emoji-rating
    if (questionElement.querySelector('.emoji-option.active')) {
        const value = questionElement.querySelector('.emoji-option.active').dataset.value;
        allSurveysProgress[currentTopic].answers[`q${index+1}`] = value;
        return true;
    }
    
    // Check star-rating
    if (questionElement.querySelector('.star.active')) {
        return true;
    }
    
    // Check multi-check
    const checkedBoxes = questionElement.querySelectorAll('input[type="checkbox"]:checked');
    if (checkedBoxes.length > 0) {
        let values = Array.from(checkedBoxes).map(cb => {
            if (cb.value === 'Khác') {
                const input = document.getElementById(`${cb.id}_input`);
                const inputVal = input && input.value.trim() ? input.value.trim() : '';
                return inputVal ? `Khác: ${inputVal}` : 'Khác';
            }
            return cb.value;
        });
        allSurveysProgress[currentTopic].answers[`q${index+1}`] = values.join(', ');
        return true;
    }
    // Check slider
    const slider = questionElement.querySelector('input[type="range"]');
    if (slider && slider.value !== '') {
        allSurveysProgress[currentTopic].answers[`q${index+1}`] = slider.value;
        return true;
    }
    
    // Check textarea
    const textarea = questionElement.querySelector('textarea');
    if (textarea && textarea.value.trim() !== '') {
        allSurveysProgress[currentTopic].answers[`q${index+1}`] = textarea.value;
        return true;
    }
    
    // Check datalist (select)
    const datalist = questionElement.querySelector('select');
    if (datalist && datalist.value !== '') {
        allSurveysProgress[currentTopic].answers[`q${index+1}`] = datalist.value;
        return true;
    }
    
    // Check radio
    const radioChecked = questionElement.querySelector('input[type="radio"]:checked');
    if (radioChecked) {
        allSurveysProgress[currentTopic].answers[`q${index+1}`] = radioChecked.value;
        return true;
    }
    
    return false;

}

function submitSurvey() {    console.log('Submitting survey for topic:', currentTopic);
    // Đánh dấu đã submit môn này
    submittedSurveys[currentTopic] = true;
    console.log('submittedSurveys after set:', submittedSurveys);
    if (currentUser) {
        localStorage.setItem(`submittedSurveys_${currentUser}`, JSON.stringify(submittedSurveys));
        console.log('Saved to localStorage');

    // Gửi dữ liệu lên Firebase của Hải
    surveyResponses.push({ 
        user: currentUser, 
        topic: currentTopic, 
        avgRating: 8, // Để tạm thời, có thể tính toán sau
        time: new Date().toISOString(),
        answers: allSurveysProgress[currentTopic]?.answers || {}
    });
    
    if(currentUser !== ADMIN_USER) {
        let user = leaderboard.find(u => u.mssv === currentUser);
        if(user) user.exp += 100;
    }

    syncDatabase(); // Đẩy dữ liệu lên Cloud
    alert("🎉 Thành công! Kết quả đã được đồng bộ online.");
    location.reload(); // Tải lại trang để cập nhật điểm mới
}}
// ==========================================
// 6. GIAO DIỆN HỖ TRỢ
// ==========================================
function updateLeaderboard() {
    const tbody = document.getElementById('ranking-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    [...leaderboard].sort((a,b) => b.exp - a.exp).forEach((u, i) => {
        tbody.innerHTML += `<tr><td>${i<3?['🥇','🥈','🥉'][i]:i+1}</td>
            <td>${u.mssv === currentUser ? `<b>${u.mssv}</b>` : u.mssv}</td>
            <td class="exp-text">+${u.exp} EXP</td></tr>`;
    });
}

function updateAsideProfile() {
    if(document.getElementById('profile-mssv')) document.getElementById('profile-mssv').innerText = currentUser || "---";
    let u = leaderboard.find(x => x.mssv === currentUser);
    if(document.getElementById('profile-exp')) document.getElementById('profile-exp').innerText = (u ? u.exp : 0) + " EXP";
    
    // Cập nhật thống kê nhanh
    updateQuickStats();
    updateTopRanking();
    updateNewsSection();
}

// Cập nhật thống kê nhanh ở sidebar
function updateQuickStats() {
    let currentUserData = leaderboard.find(x => x.mssv === currentUser);
    if (!currentUserData) return;
    
    // Đếm số khảo sát hoàn thành
    const completedTopics = ['Cơ sở vật chất', 'Chất lượng giảng viên', 'Khu vực thư viện', 'Khu vực ăn uống']
        .filter(topic => submittedSurveys[topic]).length;
    
    const stats = document.querySelectorAll('.sidebar-widget')[1]?.querySelectorAll('li strong') || [];
    if (stats.length >= 3) {
        stats[0].innerText = completedTopics + '/4';
        stats[1].innerText = currentUserData.exp;
        
        // Tìm xếp hạng
        const sorted = [...leaderboard].sort((a,b) => b.exp - a.exp);
        const rank = sorted.findIndex(u => u.mssv === currentUser) + 1;
        stats[2].innerText = rank + '/' + leaderboard.length;
    }
}

// Cập nhật top 3 xếp hạng ở sidebar
function updateTopRanking() {
    const topRankingList = document.querySelectorAll('.sidebar-widget')[3]?.querySelector('ul');
    if (!topRankingList) return;
    
    const medals = ['🥇', '🥈', '🥉'];
    const top3 = [...leaderboard].sort((a,b) => b.exp - a.exp).slice(0, 3);
    
    topRankingList.innerHTML = '';
    top3.forEach((user, index) => {
        const li = document.createElement('li');
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.gap = '10px';
        li.style.border = 'none';
        li.style.padding = '8px 0';
        li.style.margin = '8px 0';
        
        const medalSpan = document.createElement('span');
        medalSpan.style.fontSize = '20px';
        medalSpan.innerText = medals[index];
        
        const textSpan = document.createElement('span');
        textSpan.innerHTML = `<strong>${user.mssv}</strong> - ${user.exp} EXP`;
        
        li.appendChild(medalSpan);
        li.appendChild(textSpan);
        topRankingList.appendChild(li);
    });
}

// Cập nhật tin bản tin
function updateNewsSection() {
    const newsList = document.querySelectorAll('.sidebar-widget')[2]?.querySelector('ul');
    if (!newsList) return;
    
    const today = new Date();
    const yesterday = new Date(today.getTime() - 24*60*60*1000);
    const dayBefore = new Date(today.getTime() - 48*60*60*1000);
    
    const news = [
        { icon: '🟢', time: 'Mới nhất:', text: 'Khảo sát về ' + ['Cơ sở vật chất', 'Giảng viên', 'Thư viện', 'Ăn uống'][Math.floor(Math.random() * 4)] + ' đã mở!' },
        { icon: '⭐', time: 'Hôm qua:', text: 'Cập nhật bảng xếp hạng - ' + leaderboard.length + ' sinh viên tham gia' },
        { icon: '📢', time: 'Hôm kia:', text: 'Tổng ' + surveyResponses.length + ' phiếu khảo sát đã được tiếp nhận' },
        { icon: '🎉', time: 'Sự kiện:', text: 'Tuyên dương ' + Math.min(10, leaderboard.length) + ' sinh viên tích cực nhất!' }
    ];
    
    newsList.innerHTML = '';
    news.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<small>${item.icon} ${item.time}</small> ${item.text}`;
        newsList.appendChild(li);
    });
}

function checkAdminAccess() {
    const isAdmin = currentUser === ADMIN_USER;
    document.getElementById('admin-view').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('user-view').style.display = isAdmin ? 'none' : 'block';
    
    // Cập nhật thống kê ngay khi vào tab
    if (isAdmin) {
        updateAdminStats();
    }
}

function updateAdminStats() {
    // Đếm số người duy nhất đã làm khảo sát
    const uniqueUsers = new Set(surveyResponses.map(r => r.user));
    const totalSurveys = surveyResponses.length;
    const totalPeople = uniqueUsers.size;
    const totalUsers = leaderboard.length;
    const totalEXP = leaderboard.reduce((a,b)=>a+b.exp,0);
    
    // Tính thống kê theo chủ đề
    const topics = ['Cơ sở vật chất', 'Chất lượng giảng viên', 'Khu vực thư viện', 'Khu vực ăn uống'];
    const topicStats = {};
    topics.forEach(topic => {
        topicStats[topic] = surveyResponses.filter(r => r.topic === topic).length;
    });
    
    // Cập nhật stats dashboard
    const stats = document.querySelectorAll('.stat-box strong');
    if(stats.length >= 4) {
        stats[0].innerText = totalSurveys;
        stats[1].innerText = totalPeople + '/' + totalUsers;
        stats[2].innerText = totalEXP.toLocaleString();
        stats[3].innerText = totalUsers;
    }
    
    // Cập nhật chi tiết theo chủ đề (nếu có)
    const detailsList = document.getElementById('topic-details');
    if (detailsList) {
        detailsList.innerHTML = '';
        topics.forEach(topic => {
            const count = topicStats[topic];
            const percent = totalSurveys > 0 ? ((count / totalSurveys) * 100).toFixed(1) : 0;
            detailsList.innerHTML += `
                <a class="topic-stat-item topic-link" href="topic-report.html?topic=${encodeURIComponent(topic)}" target="_blank" rel="noopener">
                    <div class="topic-name">${topic}</div>
                    <div class="topic-bar">
                        <div class="topic-progress" style="width: ${percent}%"></div>
                    </div>
                    <div class="topic-count">${count} phiếu (${percent}%)</div>
                    <span class="topic-score-badge">Xem báo cáo</span>
                </a>
            `;
        });
    }
}

function normalizeAnswerLabel(question, rawValue) {
    if (rawValue === undefined || rawValue === null) return '';
    const value = String(rawValue).trim();
    if (!value) return '';

    if (question.type === 'emoji-rating' && Array.isArray(question.options)) {
        const matched = question.options.find(opt => String(opt.value) === value || String(opt.label) === value);
        return matched ? `${matched.emoji ? matched.emoji + ' ' : ''}${matched.label || value}`.trim() : value;
    }

    if (question.type === 'star-rating') {
        return `${value} sao`;
    }

    if (question.type === 'slider') {
        return `${value}%`;
    }

    return value;
}

function getTopicQuestionSummaries(topic) {
    const questions = surveyQuestionsData[topic] || [];
    const topicSurveys = surveyResponses.filter(r => r.topic === topic);
    const totalResponses = topicSurveys.length;

    return questions.map((question, index) => {
        const key = `q${index + 1}`;
        if (question.type === 'textarea') {
            const textAnswers = topicSurveys
                .map(r => r.answers?.[key])
                .filter(answer => answer !== undefined && answer !== null && String(answer).trim() !== '');
            return {
                questionText: question.text || `Câu ${index + 1}`,
                totalAnswered: textAnswers.length,
                isText: true,
                sampleAnswers: textAnswers.slice(0, 3).map(answer => String(answer).trim())
            };
        }

        const counts = {};
        topicSurveys.forEach(r => {
            const rawAnswer = r.answers?.[key];
            if (rawAnswer === undefined || rawAnswer === null || String(rawAnswer).trim() === '') return;

            if (question.type === 'multi-check') {
                String(rawAnswer)
                    .split(',')
                    .map(item => item.trim())
                    .filter(Boolean)
                    .forEach(item => {
                        const label = normalizeAnswerLabel(question, item);
                        counts[label] = (counts[label] || 0) + 1;
                    });
            } else {
                const label = normalizeAnswerLabel(question, rawAnswer);
                counts[label] = (counts[label] || 0) + 1;
            }
        });

        const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
        const totalAnswered = entries.reduce((sum, [, count]) => sum + count, 0);

        return {
            questionText: question.text || `Câu ${index + 1}`,
            totalAnswered,
            entries,
            isText: false
        };
    });
}

function renderTopicDrilldown(topic) {
    const panel = document.getElementById('topic-drilldown');
    const content = document.getElementById('topic-drilldown-content');
    const title = document.getElementById('drilldown-title');
    const summary = document.getElementById('drilldown-summary');
    if (!panel || !content || !title || !summary) return;

    if (!topic) {
        panel.style.display = 'none';
        content.innerHTML = '';
        title.innerText = 'Chi tiết phản hồi';
        summary.innerText = '';
        return;
    }

    const topicSurveys = surveyResponses.filter(r => r.topic === topic);
    const totalResponses = topicSurveys.length;
    panel.style.display = 'block';
    title.innerText = `Chi tiết: ${topic}`;
    summary.innerText = `${totalResponses} phiếu khảo sát đã nhận cho chủ đề này.`;

    if (totalResponses === 0) {
        content.innerHTML = `<div class="topic-drilldown-empty">Chưa có dữ liệu khảo sát cho chủ đề này.</div>`;
        return;
    }

    const summaries = getTopicQuestionSummaries(topic);
    content.innerHTML = summaries.map(item => {
        if (item.isText) {
            const sampleHtml = item.sampleAnswers.length > 0
                ? `<div class="topic-drilldown-empty">Câu hỏi mở: ${item.totalAnswered} phản hồi.</div><div class="text-samples">${item.sampleAnswers.map(answer => `<div class="text-sample">• ${answer}</div>`).join('')}</div>`
                : `<div class="topic-drilldown-empty">Câu hỏi mở chưa có phản hồi.</div>`;
            return `<div class="topic-question-chart"><h4>${item.questionText}</h4>${sampleHtml}</div>`;
        }

        if (item.totalAnswered === 0) {
            return `<div class="topic-question-chart"><h4>${item.questionText}</h4><div class="topic-drilldown-empty">Chưa có dữ liệu cho câu hỏi này.</div></div>`;
        }

        return `<div class="topic-question-chart">
            <h4>${item.questionText}</h4>
            ${item.entries.map(([label, count]) => {
                const percent = ((count / totalResponses) * 100).toFixed(1);
                return `<div class="answer-bar-row">
                    <div class="answer-label">${label}</div>
                    <div class="answer-bar"><div class="answer-fill" style="width:${percent}%;"></div></div>
                    <div class="answer-value">${count} (${percent}%)</div>
                </div>`;
            }).join('')}
        </div>`;
    }).join('');
}

function switchTab(id) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const btn = document.querySelector(`[data-target="${id}"]`);
    if(btn) btn.classList.add('active');
    
    // Cập nhật thống kê nếu vào tab stats
    if (id === 'tab-stats' && currentUser === ADMIN_USER) {
        setTimeout(() => updateAdminStats(), 100);
    }
}

document.querySelectorAll('.tab-btn').forEach(b => b.addEventListener('click', () => switchTab(b.dataset.target)));
if(document.getElementById('cta-survey-btn')) document.getElementById('cta-survey-btn').onclick = () => switchTab('tab-survey');

// Hàm để nút "Quay lại" hoạt động
function goBackToCategories() {
    // Ẩn bài khảo sát, hiện lại danh sách chọn môn
    document.getElementById('active-survey').style.display = 'none';
    document.getElementById('survey-categories').style.display = 'grid';
    
    // Restore lại trạng thái active và progress bar
    const surveyBoxes = document.querySelectorAll('.survey-card-box');
    surveyBoxes.forEach(b => b.classList.remove('active'));
    
    if (activeSurvey) {
        const activeBox = document.querySelector(`.survey-card-box[data-survey="${activeSurvey}"]`);
        if (activeBox) {
            activeBox.classList.add('active');
        }
    }
    
    // Cập nhật progress bar
    updateSurveyProgressBar();
    
    // Cuộn lên đầu trang cho đẹp
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ==========================================
// 8. HIỆU ỨNG CLICK - ĐỔI MÀU CỘI KHẢO SÁT VÀ THANH TIẾN ĐỘ
// ==========================================

// Function để lưu trạng thái (theo user)
function saveSurveyState() {
    if (currentUser) {
        localStorage.setItem(`activeSurvey_${currentUser}`, activeSurvey || '');
        localStorage.setItem(`allSurveysProgress_${currentUser}`, JSON.stringify(allSurveysProgress));
    }
}

function updateSurveyProgressBar() {
    // Map từ topic name sang data-survey value
    const surveyMap = {
        'Cơ sở vật chất': 'facility',
        'Chất lượng giảng viên': 'teacher',
        'Khu vực thư viện': 'library',
        'Khu vực ăn uống': 'dining'
    };
    
    // Map ngược
    const topicMap = {
        'facility': 'Cơ sở vật chất',
        'teacher': 'Chất lượng giảng viên',
        'library': 'Khu vực thư viện',
        'dining': 'Khu vực ăn uống'
    };
    
    // Cập nhật progress bar cho tất cả các ô
    Object.keys(surveyMap).forEach(topicName => {
        const dataKey = surveyMap[topicName];
        if (allSurveysProgress[topicName]) {
            const answers = allSurveysProgress[topicName].answers || {};
            const answeredCount = Object.keys(answers).length;
            // Lấy số câu thực tế từ surveyQuestionsData
            let totalQuestions = 5; // default
            if (surveyQuestionsData[topicName]) {
                totalQuestions = surveyQuestionsData[topicName].length;
            }
            
            const progressPercent = (answeredCount / totalQuestions) * 100;
            
            const progressBar = document.querySelector(`.survey-progress-bar[data-survey="${dataKey}"]`);
            if (progressBar) {
                progressBar.style.width = progressPercent + '%';
            }
        }
    });
    
    // Cập nhật trạng thái hoàn thành
    Object.keys(topicMap).forEach(dataKey => {
        const topicName = topicMap[dataKey];
        const box = document.querySelector(`.survey-card-box[data-survey="${dataKey}"]`);
        if (box) {
            const cornerText = box.querySelector('.corner-text');
            const bottomText = box.querySelector('.bottom-text');
            console.log('Checking topic:', topicName, 'submittedSurveys:', submittedSurveys, 'has:', submittedSurveys[topicName]);
            if (submittedSurveys[topicName]) {
                box.classList.add('completed');
                if (cornerText) cornerText.textContent = 'Đã làm khảo sát';
                if (bottomText) bottomText.style.display = 'block';
            } else {
                box.classList.remove('completed');
                if (cornerText) cornerText.textContent = 'Chưa làm khảo sát';
                if (bottomText) bottomText.style.display = 'none';
            }
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    const surveyBoxes = document.querySelectorAll('.survey-card-box');
    
    // Restore trạng thái active từ localStorage
    if (activeSurvey) {
        const activeBox = document.querySelector(`.survey-card-box[data-survey="${activeSurvey}"]`);
        if (activeBox) {
            activeBox.classList.add('active');
        }
    }
    
    // Cập nhật progress bar ban đầu
    updateSurveyProgressBar();
    
    surveyBoxes.forEach(box => {
        const cornerText = box.querySelector('.corner-text');
        const bottomText = box.querySelector('.bottom-text');
        const topicMap = {
            'facility': 'Cơ sở vật chất',
            'teacher': 'Chất lượng giảng viên',
            'library': 'Khu vực thư viện',
            'dining': 'Khu vực ăn uống'
        };
        const topic = topicMap[box.dataset.survey];
        
        // Click trên box để start survey lần đầu
        box.addEventListener('click', function(e) {
            if (!e.target.closest('.corner-text') && !e.target.closest('.bottom-text')) {
                startSurvey(topic);
                // Xóa active khỏi các box khác
                surveyBoxes.forEach(b => b.classList.remove('active'));
                // Thêm active vào box được click
                this.classList.add('active');
                // Lưu trạng thái active
                activeSurvey = this.dataset.survey;
                saveSurveyState();
            }
        });
        
        // Click trên corner-text hoặc bottom-text để khảo sát bổ sung
        const handleClick = () => startSurvey(topic);
        if (cornerText) cornerText.addEventListener('click', handleClick);
        if (bottomText) bottomText.addEventListener('click', handleClick);
    });
    
    // Thiết lập export/import buttons
    setupExportImport();
});

// ==========================================
// 9. EXPORT VÀ IMPORT DỮ LIỆU
// ==========================================
function setupExportImport() {
    const exportBtn = document.getElementById('export-data-btn');
    const importBtn = document.getElementById('import-data-btn');
    const importInput = document.getElementById('import-data-input');
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
    }
    
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            if (importInput) importInput.click();
        });
    }
    
    if (importInput) {
        importInput.addEventListener('change', handleImportData);
    }
}

function exportData() {
    // Tạo object chứa toàn bộ dữ liệu
    const dataToExport = {
        leaderboard: leaderboard,
        surveyResponses: surveyResponses,
        exportDate: new Date().toISOString(),
        totalUsers: leaderboard.length,
        totalSurveys: surveyResponses.length,
        uniqueParticipants: new Set(surveyResponses.map(r => r.user)).size
    };
    
    // Chuyển thành JSON string
    const dataStr = JSON.stringify(dataToExport, null, 2);
    
    // Tạo Blob và download
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `survey-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('✅ Đã xuất dữ liệu thành công!');
}

function handleImportData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // Kiểm tra tính hợp lệ của dữ liệu
            if (!importedData.leaderboard || !Array.isArray(importedData.leaderboard)) {
                throw new Error('Định dạng file không hợp lệ');
            }
            
            // Xác nhận trước khi import
            const confirmation = confirm(
                `Bạn có chắc chắn muốn import dữ liệu?\n\n` +
                `Được import:\n` +
                `- ${importedData.leaderboard.length} người dùng\n` +
                `- ${importedData.surveyResponses.length} phiếu khảo sát\n\n` +
                `Dữ liệu hiện tại sẽ bị ghi đè!`
            );
            
            if (!confirmation) {
                alert('❌ Đã hủy quá trình import');
                return;
            }
            
            // Cập nhật dữ liệu
            leaderboard = importedData.leaderboard || [];
            surveyResponses = importedData.surveyResponses || [];
            
            // Đồng bộ lên Firebase
            syncDatabase();
            
            // Cập nhật UI
            updateLeaderboard();
            updateAdminStats();
            updateAsideProfile();
            
            alert('✅ Đã import dữ liệu thành công! Trang sẽ tải lại để cập nhật.');
            setTimeout(() => location.reload(), 1500);
            
        } catch (error) {
            alert('❌ Lỗi khi import dữ liệu: ' + error.message);
            console.error('Import error:', error);
        }
    };
    reader.readAsText(file);
    
    // Reset input để có thể chọn file cùng tên lần nữa
    event.target.value = '';
}
