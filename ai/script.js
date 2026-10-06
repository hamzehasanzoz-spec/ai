// 1. إعدادات قاعدة بيانات Supabase
const SUPABASE_URL = 'https://kwvctwyydqrooqrwzssn.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3dmN0d3l5ZHFyb29xcnd6c3NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEyMjcyNTEsImV4cCI6MjEwNjgwMzI1MX0.9TdOHBb6AkN8QmYmzqQx8rmctQvhmnAvLyinv0Sy-oE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let chatHistory = [];

// 2. تسجيل المشتركين الجدد (المرحلة الأولى)
const subscribeForm = document.getElementById('subscribeForm');
subscribeForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fullName = document.getElementById('fullName').value.trim();
    const email = document.getElementById('email').value.trim();
    const subBtn = document.getElementById('subBtn');
    const subStatus = document.getElementById('subStatus');

    subBtn.disabled = true;
    subBtn.innerText = 'جاري الحفظ...';

    try {
        const { error } = await supabase
            .from('subscribers')
            .insert([{ full_name: fullName, email: email }]);

        if (error) throw error;

        subStatus.className = 'text-xs text-emerald-400 font-semibold';
        subStatus.innerText = '✓ تم تسجيلك بنجاح في دفعة كوتش AI!';
        subscribeForm.reset();
    } catch (err) {
        subStatus.className = 'text-xs text-rose-400 font-semibold';
        subStatus.innerText = 'حدث خطأ: ' + (err.message || 'تعذر الاتصال بـ Supabase');
    } finally {
        subBtn.disabled = false;
        subBtn.innerText = 'انضمام للدفعة';
    }
});

// 3. حفظ بيانات الاستبيان (المرحلة الثانية)
function saveSurvey() {
    const surveyData = {
        weakTopics: document.getElementById('weakTopics').value,
        learningStyle: document.getElementById('learningStyle').value,
        updatedAt: new Date().toISOString()
    };

    localStorage.setItem('coach_survey_data', JSON.stringify(surveyData));
    
    const surveyStatus = document.getElementById('surveyStatus');
    surveyStatus.innerText = '✓ تم حفظ تفضيلاتك وربطها بمحرك الذكاء الاصطناعي بنجاح!';
}

// 4. إرسال المحادثة واستقبال الرد من الذكاء الاصطناعي (المرحلة الثالثة)
async function sendChatMessage() {
    const userInput = document.getElementById('userInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatBox = document.getElementById('chatBox');
    const message = userInput.value.trim();

    if (!message) return;

    // طباعة رسالة الطالب
    chatBox.innerHTML += `
        <div class="p-3 rounded-lg bg-slate-800 text-slate-100 border border-slate-700 text-right">
            <strong>أنت:</strong> ${escapeHtml(message)}
        </div>
    `;
    userInput.value = '';
    chatBox.scrollTop = chatBox.scrollHeight;

    // تعطيل الزر أثناء الانتظار
    sendBtn.disabled = true;

    // جلب بيانات الاستبيان المخزنة محلياً
    const savedSurvey = JSON.parse(localStorage.getItem('coach_survey_data') || '{}');

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                message: message,
                surveyData: savedSurvey,
                history: chatHistory
            })
        });

        const data = await response.json();

        if (!response.ok) throw new Error(data.error || 'فشل الحصول على رد من كوتش AI');

        // إضافة الرد وسياق المحادثة
        chatHistory.push({ role: 'user', content: message });
        chatHistory.push({ role: 'assistant', content: data.reply });

        chatBox.innerHTML += `
            <div class="p-3 rounded-lg bg-sky-900/40 text-sky-200 border border-sky-800/50 text-right">
                <strong>كوتش AI:</strong> ${formatReply(data.reply)}
            </div>
        `;
    } catch (err) {
        chatBox.innerHTML += `
            <div class="p-3 rounded-lg bg-rose-900/40 text-rose-300 border border-rose-800/50 text-right">
                <strong>خطأ:</strong> ${err.message}
            </div>
        `;
    } finally {
        sendBtn.disabled = false;
        chatBox.scrollTop = chatBox.scrollHeight;
    }
}

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, function(m) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]; });
}

function formatReply(text) {
    return text.replace(/\n/g, '<br>');
}