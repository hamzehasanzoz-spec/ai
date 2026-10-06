// api/chat.js - السيرفر الخفي لمنصة كوتش AI
export default async function handler(req, res) {
    // إعدادات CORS وتحديد نوع الطلب
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'طريقة الطلب غير مسموحة' });
    }

    try {
        const { message, surveyData, history } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!apiKey) {
            return res.status(500).json({ error: 'مفتاح GEMINI_API_KEY غير مضاف في إعدادات البيئة بـ Vercel' });
        }

        // 1. البرومبت التخصصي لكوتش AI الطبي
        const systemPrompt = `أنت "كوتش AI"، مستشار طبي وتعليمي خبير ومتخصص في دعم طلاب الطب البشري في سوريا للامتحان الوطني الموحد 2026.

[بيانات الطالب من الاستبيان]:
- الكتل الأكثر صعوبة: ${surveyData?.weakTopics || surveyData?.fear_subjects?.join(', ') || 'جميع الكتل الطبية'}
- أسلوب الشرح المفضّل: ${surveyData?.learningStyle || surveyData?.preferred_method || 'تفنيد الخيارات وحل الأسئلة'}

[تعليمات الإجابة]:
1. أسلوبك علمي، متخصّص، مشجع وداعم.
2. ركّز على المفاتيح التشخيصية (Key Diagnostic Words) والفرز بين التشخيص التفريقي لكل مرض.
3. راعِ معايير أسئلة الدورات الامتحانية لوزارة التعليم العالي في سوريا.
4. اختم شرحك دائماً بسؤال اختياري (MCQ) قصير لتختبر فهم الطالب مباشرةً.`;

        // 2. تجهيز هيكلية المحادثة
        const formattedContents = [
            {
                role: 'user',
                parts: [{ text: systemPrompt }]
            },
            {
                role: 'model',
                parts: [{ text: 'أهلاً بك يا دكتور! أنا جاهز تماماً لمساعدتك في التحضير للامتحان الوطني الموحد.' }]
            }
        ];

        // إدراج سجل المحادثة السابق
        if (Array.isArray(history) && history.length > 0) {
            history.forEach(h => {
                formattedContents.push({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.content }]
                });
            });
        }

        // إدراج السؤال الحالي
        formattedContents.push({
            role: 'user',
            parts: [{ text: message }]
        });

        // 3. النماذج المعتمدة النشطة (تم استبعاد gemini-2.0-flash-lite)
        const modelsToTry = ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'];
        let replyText = null;
        let lastErrorMessage = '';

        for (const modelName of modelsToTry) {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contents: formattedContents })
            });

            const data = await response.json();

            if (response.ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
                replyText = data.candidates[0].content.parts[0].text;
                break;
            } else {
                lastErrorMessage = data.error?.message || 'تعذر جلب الاستجابة';
            }
        }

        if (replyText) {
            return res.status(200).json({ reply: replyText });
        } else {
            return res.status(500).json({ error: `خطأ Gemini: ${lastErrorMessage}` });
        }

    } catch (err) {
        return res.status(500).json({ error: `خطأ داخلي في خادم كوتش AI: ${err.message}` });
    }
}