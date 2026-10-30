'use strict';
/* =========================================================
   ReturnPlay — قاعدة بيانات مكتبة التمارين والمراحل
   ملاحظة: المحتوى تعليمي عام ولا يغني عن قرار الطبيب أو
   أخصائي العلاج الطبيعي / التأهيل الرياضي.
   ========================================================= */

const REGIONS = {
  neck:       { ar: 'الرقبة',               cat: 'muscle', view: 'front' },
  shoulder:   { ar: 'الكتف',                cat: 'both',   view: 'front' },
  elbow:      { ar: 'المرفق',               cat: 'joint',  view: 'front' },
  wrist:      { ar: 'الرسغ واليد',          cat: 'joint',  view: 'front' },
  chest_abs:  { ar: 'البطن والجذع',         cat: 'muscle', view: 'front' },
  groin:      { ar: 'الضامّة (داخل الفخذ)',  cat: 'muscle', view: 'front' },
  quad:       { ar: 'أمامية الفخذ',         cat: 'muscle', view: 'front' },
  knee:       { ar: 'الركبة',               cat: 'joint',  view: 'front' },
  ankle:      { ar: 'الكاحل والقدم',        cat: 'joint',  view: 'front' },
  lower_back: { ar: 'أسفل الظهر (القطنية)',  cat: 'both',   view: 'back' },
  hip:        { ar: 'الورك والحوض',         cat: 'both',   view: 'back' },
  hamstring:  { ar: 'خلفية الفخذ',          cat: 'muscle', view: 'back' },
  calf:       { ar: 'بطة الساق ووأكيليس',   cat: 'muscle', view: 'back' }
};
const CAT_LABEL = { muscle: '💪 عضلة', joint: '🦴 مفصل / هيكل', both: '💪 عضلة + 🦴 مفصل' };

/* مناطق ذات صلة تُستخدم لتوسيع اقتراحات التمارين (المفصل والعضلات المجاورة) */
const REGION_RELATED = {
  neck: ['neck', 'shoulder'],
  shoulder: ['shoulder', 'neck', 'chest_abs'],
  elbow: ['elbow', 'wrist'],
  wrist: ['wrist', 'elbow'],
  chest_abs: ['chest_abs', 'lower_back', 'hip'],
  groin: ['groin', 'hip', 'chest_abs'],
  quad: ['quad', 'knee', 'hip'],
  lower_back: ['lower_back', 'hip', 'chest_abs'],
  hip: ['hip', 'lower_back', 'hamstring', 'groin'],
  hamstring: ['hamstring', 'hip', 'calf'],
  knee: ['knee', 'quad', 'calf', 'hip'],
  calf: ['calf', 'ankle', 'knee'],
  ankle: ['ankle', 'calf', 'knee']
};

const SECTIONS = {
  warmup:   { ar: 'الإحماء والتنشيط', color: '#2f9e8f' },
  main:     { ar: 'الجزء الأساسي',    color: '#3a7d5c' },
  cooldown: { ar: 'الإطالات والهدوء', color: '#c98a2d' }
};

const PHASES = {
  acute: {
    n: 1, key: 'acute', en: 'ACUTE',
    ar: 'المرحلة ١ — تهدئة وحماية',
    span: 'أول ٣–٧ أيام تقريبًا (حسب شدة الإصابة)',
    goal: 'تقليل الألم والتورم، حماية النسيج المصاب، والحفاظ على حركة بسيطة بدون ألم.',
    criteria: [
      'ألم أقل من 3/10 أثناء الحياة اليومية',
      'مشي بدون عرج (لإصابات الطرف السفلي)',
      'التورم في تناقص مستمر',
      'المدى الحركي يتحسن من يوم لآخر'
    ]
  },
  subacute: {
    n: 2, key: 'subacute', en: 'SUB-ACUTE',
    ar: 'المرحلة ٢ — حركة وتنشيط',
    span: 'من نهاية الأسبوع الأول وحتى ~3 أسابيع',
    goal: 'استعادة المدى الحركي، تنشيط العضلات المحيطة بالإصابة، وبدء تحميل خفيف بدون ألم.',
    criteria: [
      'ألم ≤ 2/10 أثناء التمرين ويتلاشى سريعًا بعده',
      'مدى حركة شبه كامل بدون ألم',
      'أداء التمارين الأساسية بجودة وثبات'
    ]
  },
  strength: {
    n: 3, key: 'strength', en: 'STRENGTH',
    ar: 'المرحلة ٣ — قوة وإعادة بناء',
    span: 'من ~3 إلى 8 أسابيع',
    goal: 'بناء قوة وتحمّل للعضلة أو المفصل المصاب مع تصعيد تدريجي للتحميل.',
    criteria: [
      'قوة الطرف المصاب ≥ 85% من الطرف السليم',
      'أداء تمارين المقاومة بدون ألم أو تورم بعدها',
      'تحسّن واضح في التوازن والثبات'
    ]
  },
  rtp: {
    n: 4, key: 'rtp', en: 'RETURN TO PLAY',
    ar: 'المرحلة ٤ — العودة للملاعب',
    span: 'حسب الرياضة والمركز — عادة بعد الأسبوع السادس أو أكثر',
    goal: 'تحويل القوة المكتسبة إلى أداء رياضي: سرعة، تغيير اتجاه، قفز، ومهارات خاصة بمركز اللاعب.',
    criteria: [
      'اجتياز اختبارات وظيفية (عدو/قفز/تغيير اتجاه) بدون أعراض',
      'تحمّل حصتَي تدريب كاملتين في يومين متتاليين',
      'ثقة اللاعب عالية وعدم تردده في الأداء'
    ]
  }
};

const INJURY_TYPES = {
  strain: {
    ar: 'شد أو تمزق عضلي',
    grades: ['درجة أولى (بسيط)', 'درجة ثانية (متوسط)', 'درجة ثالثة (تمزق كامل — غالبًا جراحي)'],
    advice: {
      acute: 'راحة نسبية + كمادات ثلج 15 دقيقة عدة مرات يوميًا. ممنوع الإطالات العنيفة. تثبيت إيسومتري خفيف جدًا فقط إن كان بدون ألم.',
      subacute: 'ابدأ تحميلًا خفيفًا متدرجًا. القاعدة: ألم ≤ 2/10 أثناء التمرين ويتلاشى خلال 24 ساعة.',
      strength: 'التركيز على التحميل اللامركزي (Eccentric) البطيء — هو الأهم في منع رجوع الإصابة.',
      rtp: 'قبل العودة الكاملة: عدو تدريجي ← تغيير اتجاه ← سبرنتات بسرعة متزايدة.'
    }
  },
  sprain: {
    ar: 'التواء مفصل / أربطة',
    grades: ['بسيط (Grade I)', 'متوسط (Grade II)', 'شديد (Grade III)'],
    advice: {
      acute: 'حماية المفصل، رفع الطرف المصاب، ثلج، وضغط برباط. الحركة المبكرة بدون ألم أفضل من تثبيت طويل.',
      subacute: 'استعادة المدى الحركي كاملًا أولًا، ثم بدء تمارين التوازن مبكرًا — أهم عنصر في التواءات الكاحل.',
      strength: 'قوة + توازن على أسطح غير مستقرة + تدريب الإدراك الحسي الحركي (Proprioception).',
      rtp: 'اختبارات قفز وتغيير اتجاه مطلوبة قبل السماح بالمشاركة.'
    }
  },
  tendon: {
    ar: 'التهاب أو تنكّس وتر (Tendinopathy)',
    grades: ['مزمن بسيط', 'متهيّج حاليًا'],
    advice: {
      acute: 'تثبيت إيسومتري 5×45 ثانية بجهد متوسط — يخفف الألم غالبًا. تجنّب أي طفرة مفاجئة في التحميل.',
      subacute: 'تحميل بطيء ثقيل متدرج (Heavy Slow Resistance) هو الأساس.',
      strength: 'استمر في التحميل التدريجي؛ ألم حتى 3/10 يرجع لأسفل بعد 24 ساعة أمر مقبول.',
      rtp: 'حافظ على تمرينين أسبوعيًا للوتر حتى بعد العودة لمنع الانتكاس.'
    }
  },
  overuse: {
    ar: 'إجهاد متكرر / آلام مزمنة',
    grades: ['خفيف', 'متوسط'],
    advice: {
      acute: 'قلّل حجم التدريب 30–50% وابحث عن الأسباب: الأحذية، الأسطح، القفزات المفاجئة في الحجم.',
      subacute: 'ارجع للحجم التدريبي تدريجيًا (+10% أسبوعيًا) مع مراقبة الأعراض بعد كل جلسة.',
      strength: 'عالج ضعف العضلات المجاورة — ضعف الورك مثلاً سبب شائع لآلام الركبة.',
      rtp: 'راقب الحمل الأسبوعي الإجمالي وتجنّب القفزات المفاجئة في الحجم.'
    }
  },
  postop: {
    ar: 'بعد عملية جراحية',
    grades: ['أسبوع 0–6', 'أسبوع 6–12', 'أكثر من 3 شهور'],
    advice: {
      acute: 'التزم بروتوكول الجراح حرفيًا — هذا البرنامج مسودة تُعدَّل مع أخصائي التأهيل.',
      subacute: 'تدرّج بطيء: مدى حركة ← تفعيل عضلي ← تحميل.',
      strength: 'عادًا لبروتوكول الجراحة دائمًا؛ لا تستبق أي مرحلة.',
      rtp: 'العودة بموافقة الجراح + اختبارات وظيفية معيارية (مثل تطابق القوة LSI ≥ 90%).'
    }
  },
  bone: {
    ar: 'إجهاد عظمي / بعد كسر',
    grades: ['إجهاد عظمي (Stress)', 'بعد التئام كسر'],
    advice: {
      acute: 'التحميل الوزني حسب قرار الطبيب فقط. السباحة أو الدراجة بديل آمن غالبًا للحفاظ على اللياقة.',
      subacute: 'زيادة التحميل الوزني تدريجيًا بعد تصريح الطبيب فقط.',
      strength: 'حمل محوري متدرج (وقوف ← قرفصاء ← قفز خفيف) مع مراقبة الألم الموضعي.',
      rtp: 'ألم موضعي صفر + أي صور متابعة طلبها الطبيب.'
    }
  }
};

/* رسوم توضيحية (SVG) لأنماط الحركة — كل تمرين يُسند إلى نمط */
const FIG = 'stroke="#17434f" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const THIN = 'stroke="#17434f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"';
const PATTERNS = {
  rom:       { ar: 'مدى حركي',  accent: '#4f7cc9', svg: `<circle cx="100" cy="34" r="11" fill="#17434f"/><line x1="100" y1="46" x2="100" y2="76" ${FIG}/><line x1="100" y1="76" x2="88" y2="120" ${FIG}/><line x1="100" y1="76" x2="112" y2="120" ${FIG}/><line x1="100" y1="52" x2="132" y2="66" ${FIG}/><path d="M136 44a34 34 0 0 1 12 46" stroke="#4f7cc9" stroke-width="5" fill="none" stroke-dasharray="4 7"/><path d="M148 90l-7-2 5-6" fill="#4f7cc9"/>` },
  iso:       { ar: 'تثبيت إيسومتري', accent: '#2f9e8f', svg: `<circle cx="118" cy="42" r="11" fill="#17434f"/><line x1="114" y1="54" x2="92" y2="84" ${FIG}/><line x1="92" y1="84" x2="80" y2="120" ${FIG}/><line x1="92" y1="84" x2="106" y2="120" ${FIG}/><line x1="112" y1="56" x2="138" y2="50" ${FIG}/><path d="M144 42v18M150 40v22" stroke="#2f9e8f" stroke-width="4"/><line x1="142" y1="24" x2="142" y2="128" stroke="#17434f" stroke-width="4" opacity=".35"/>` },
  band:      { ar: 'تمرين بمطاط مقاومة', accent: '#d97757', svg: `<circle cx="96" cy="30" r="11" fill="#17434f"/><line x1="96" y1="42" x2="96" y2="72" ${FIG}/><line x1="96" y1="72" x2="86" y2="120" ${FIG}/><line x1="96" y1="72" x2="108" y2="120" ${FIG}/><path d="M50 78q46-26 100 0" stroke="#d97757" stroke-width="5" fill="none"/><line x1="76" y1="56" x2="62" y2="74" ${THIN}/><line x1="116" y1="56" x2="130" y2="74" ${THIN}/>` },
  push:      { ar: 'دفع', accent: '#4f7cc9', svg: `<circle cx="130" cy="62" r="11" fill="#17434f"/><line x1="120" y1="70" x2="82" y2="94" ${FIG}/><line x1="82" y1="94" x2="50" y2="116" ${FIG}/><line x1="126" y1="74" x2="146" y2="62" ${THIN}/><line x1="146" y1="30" x2="146" y2="120" stroke="#17434f" stroke-width="4" opacity=".35"/>` },
  deadbug:   { ar: 'استلقاء وتحكم جذع', accent: '#6aa84f', svg: `<circle cx="36" cy="84" r="10" fill="#17434f"/><line x1="48" y1="90" x2="108" y2="90" ${FIG}/><line x1="58" y1="86" x2="66" y2="56" ${THIN}/><line x1="100" y1="90" x2="112" y2="68" ${FIG}/><line x1="112" y1="68" x2="128" y2="78" ${THIN}/><line x1="100" y1="92" x2="140" y2="96" ${THIN}/>` },
  birddog:   { ar: 'أربع نقاط وثبات', accent: '#6aa84f', svg: `<circle cx="110" cy="72" r="10" fill="#17434f"/><line x1="100" y1="84" x2="68" y2="110" ${FIG}/><line x1="100" y1="86" x2="134" y2="76" ${THIN}/><line x1="68" y1="112" x2="30" y2="120" ${THIN}/><line x1="100" y1="86" x2="100" y2="120" ${THIN}/><line x1="68" y1="112" x2="68" y2="120" ${THIN}/>` },
  plank:     { ar: 'بلانك', accent: '#c98a2d', svg: `<circle cx="124" cy="76" r="10" fill="#17434f"/><line x1="114" y1="84" x2="34" y2="96" ${FIG}/><line x1="88" y1="92" x2="88" y2="120" ${THIN}/><line x1="88" y1="120" x2="60" y2="120" ${THIN}/><line x1="34" y1="98" x2="30" y2="120" ${THIN}/>` },
  sideplank: { ar: 'بلانك جانبي', accent: '#c98a2d', svg: `<circle cx="132" cy="66" r="10" fill="#17434f"/><line x1="122" y1="74" x2="84" y2="96" ${FIG}/><line x1="84" y1="96" x2="38" y2="118" ${FIG}/><line x1="120" y1="92" x2="120" y2="120" ${THIN}/><line x1="122" y1="74" x2="142" y2="50" ${THIN}/>` },
  bridge:    { ar: 'جسر / رفع حوض', accent: '#6aa84f', svg: `<circle cx="42" cy="94" r="10" fill="#17434f"/><line x1="54" y1="100" x2="110" y2="88" ${FIG}/><line x1="110" y1="88" x2="132" y2="108" ${FIG}/><line x1="132" y1="108" x2="128" y2="122" ${FIG}/><line x1="62" y1="110" x2="100" y2="114" ${THIN}/>` },
  hinge:     { ar: 'مفصلة ورك', accent: '#2f9e8f', svg: `<circle cx="128" cy="40" r="11" fill="#17434f"/><line x1="124" y1="50" x2="82" y2="80" ${FIG}/><line x1="104" y1="64" x2="96" y2="98" ${THIN}/><line x1="82" y1="80" x2="100" y2="102" ${FIG}/><line x1="100" y1="102" x2="98" y2="122" ${FIG}/>` },
  squat:     { ar: 'قرفصاء', accent: '#4f7cc9', svg: `<circle cx="92" cy="30" r="11" fill="#17434f"/><line x1="94" y1="42" x2="94" y2="72" ${FIG}/><line x1="96" y1="50" x2="128" y2="62" ${THIN}/><line x1="94" y1="72" x2="120" y2="88" ${FIG}/><line x1="120" y1="88" x2="122" y2="120" ${FIG}/><line x1="94" y1="72" x2="110" y2="92" ${FIG}/><line x1="110" y1="92" x2="108" y2="120" ${FIG}/>` },
  lunge:     { ar: 'طعن / لانج', accent: '#d97757', svg: `<circle cx="100" cy="28" r="11" fill="#17434f"/><line x1="100" y1="40" x2="100" y2="72" ${FIG}/><line x1="100" y1="72" x2="120" y2="90" ${FIG}/><line x1="120" y1="90" x2="124" y2="120" ${FIG}/><line x1="100" y1="72" x2="78" y2="104" ${FIG}/><line x1="78" y1="104" x2="60" y2="118" ${FIG}/><line x1="102" y1="52" x2="116" y2="84" ${THIN}/>` },
  stepup:    { ar: 'صعود على درجة', accent: '#4f7cc9', svg: `<rect x="52" y="96" width="52" height="28" rx="6" fill="none" stroke="#17434f" stroke-width="4"/><circle cx="112" cy="24" r="11" fill="#17434f"/><line x1="112" y1="36" x2="112" y2="62" ${FIG}/><line x1="112" y1="62" x2="98" y2="94" ${FIG}/><line x1="98" y1="94" x2="86" y2="94" ${FIG}/><line x1="112" y1="62" x2="128" y2="94" ${FIG}/><line x1="128" y1="94" x2="134" y2="118" ${FIG}/><line x1="114" y1="46" x2="136" y2="32" ${THIN}/>` },
  calfraise: { ar: 'رفع كعب', accent: '#2f9e8f', svg: `<circle cx="96" cy="26" r="11" fill="#17434f"/><line x1="96" y1="38" x2="96" y2="72" ${FIG}/><line x1="96" y1="72" x2="94" y2="114" ${FIG}/><line x1="94" y1="114" x2="106" y2="122" ${THIN}/><line x1="96" y1="72" x2="108" y2="114" ${FIG}/><line x1="96" y1="48" x2="134" y2="58" ${THIN}/><line x1="140" y1="30" x2="140" y2="124" stroke="#17434f" stroke-width="4" opacity=".35"/>` },
  balance:   { ar: 'توازن', accent: '#c98a2d', svg: `<circle cx="96" cy="28" r="11" fill="#17434f"/><line x1="96" y1="40" x2="96" y2="74" ${FIG}/><line x1="96" y1="74" x2="96" y2="120" ${FIG}/><line x1="96" y1="74" x2="76" y2="94" ${FIG}/><line x1="96" y1="94" x2="88" y2="106" ${THIN}/><line x1="96" y1="50" x2="64" y2="44" ${THIN}/><line x1="96" y1="50" x2="128" y2="44" ${THIN}/>` },
  jump:      { ar: 'قفز / بلايومتركس', accent: '#d97757', svg: `<circle cx="100" cy="20" r="11" fill="#17434f"/><line x1="100" y1="32" x2="98" y2="60" ${FIG}/><line x1="98" y1="60" x2="84" y2="76" ${FIG}/><line x1="84" y1="76" x2="96" y2="88" ${FIG}/><line x1="100" y1="38" x2="122" y2="24" ${THIN}/><line x1="100" y1="38" x2="78" y2="24" ${THIN}/><path d="M60 112h18M122 112h18" stroke="#d97757" stroke-width="4"/>` },
  stretch:   { ar: 'إطالة', accent: '#c98a2d', svg: `<circle cx="132" cy="88" r="10" fill="#17434f"/><line x1="124" y1="96" x2="94" y2="106" ${FIG}/><line x1="94" y1="106" x2="40" y2="106" ${FIG}/><line x1="124" y1="96" x2="142" y2="104" ${THIN}/><path d="M30 84a40 30 0 0 1 44-8" stroke="#c98a2d" stroke-width="4" fill="none" stroke-dasharray="4 7"/>` },
  ball:      { ar: 'ضغط كرة', accent: '#6aa84f', svg: `<circle cx="34" cy="82" r="10" fill="#17434f"/><line x1="46" y1="88" x2="104" y2="88" ${FIG}/><line x1="104" y1="88" x2="110" y2="62" ${FIG}/><circle cx="114" cy="56" r="13" fill="#6aa84f" opacity=".55"/><line x1="122" y1="48" x2="132" y2="62" ${THIN}/><line x1="54" y1="82" x2="40" y2="62" ${THIN}/>` },
  sideleg:   { ar: 'رفع جانبي', accent: '#4f7cc9', svg: `<circle cx="36" cy="98" r="10" fill="#17434f"/><line x1="48" y1="104" x2="104" y2="100" ${FIG}/><line x1="104" y1="100" x2="134" y2="72" ${FIG}/><line x1="104" y1="102" x2="140" y2="116" ${THIN}/><line x1="52" y1="98" x2="44" y2="80" ${THIN}/>` },
  agility:   { ar: 'سرعة وتغيير اتجاه', accent: '#d97757', svg: `<circle cx="96" cy="30" r="11" fill="#17434f"/><line x1="96" y1="42" x2="100" y2="72" ${FIG}/><line x1="100" y1="72" x2="122" y2="92" ${FIG}/><line x1="122" y1="92" x2="132" y2="116" ${FIG}/><line x1="100" y1="72" x2="76" y2="98" ${FIG}/><line x1="76" y1="98" x2="60" y2="116" ${FIG}/><line x1="98" y1="50" x2="122" y2="62" ${THIN}/><path d="M20 124l30-8 30 8 30-8 30 8" stroke="#d97757" stroke-width="4" fill="none" stroke-dasharray="5 7"/><path d="M138 100l8 10-12 2" fill="#d97757" opacity=".8"/>` }
};

/* ============ مكتبة التمارين ============
   [id, ar, en, pattern, regions[], phases[], section, tag, desc, cues[], dose{}, prog, videoQuery]
*/
const EXERCISES = [
  // ===== إحماء عام =====
  { id: 'walk-bike', ar: 'مشي أو دراجة ثابتة', en: 'Warm-up walk / stationary bike', pattern: 'rom', regions: ['hip','quad','hamstring','knee','calf','ankle','groin','lower_back','chest_abs'], phases: ['subacute','strength','rtp'], section: 'warmup', tag: 'rom',
    desc: 'إحماء عام يرفع حرارة الجسم والدم في الطرف المصاب قبل أي تمرين تحميلي.',
    cues: ['خفيف جدًا وبدون ألم', 'الهدف التعرق الخفيف فقط — ليس مجهودًا'],
    dose: { subacute: '5–8 دقائق', strength: '8–10 دقائق', rtp: '10 دقائق' },
    prog: 'مع تحسن الحالة يمكن الانتقال من المشي إلى دراجة ثم جري خفيف في مرحلة العودة.',
    video: 'stationary bike warm up before workout' },

  { id: 'dyn-legs', ar: 'تأرجحات أرجل ديناميكية', en: 'Dynamic leg swings', pattern: 'rom', regions: ['hip','quad','hamstring','groin','knee'], phases: ['subacute','strength','rtp'], section: 'warmup', tag: 'mobility',
    desc: 'تأرجح الساق أمامًا وخلفًا وجانبًا بحركة متحكم بها لإحماء مفصل الورك والفخذ.',
    cues: ['اسند يدك على حائط', 'الحركة من الورك وليس من أسفل الظهر', 'زود المدى تدريجيًا'],
    dose: { subacute: '2×10 لكل اتجاه', strength: '2×12', rtp: '2×15' },
    prog: 'من تأرجح صغير إلى مدى كامل ثم بتوقّف في نهاية المدى.',
    video: 'dynamic leg swings warm up' },

  { id: 'arm-circles', ar: 'تدويرات الذراع والكتف', en: 'Arm circles', pattern: 'rom', regions: ['shoulder','neck','elbow','wrist','chest_abs'], phases: ['acute','subacute','strength','rtp'], section: 'warmup', tag: 'rom',
    desc: 'إحماء عام للحزام الكتفي قبل تمارين الكتف أو الجذع.',
    cues: ['دوائر صغيرة تكبر تدريجيًا', 'بدون رفع الكتف نحو الأذن'],
    dose: { acute: '2×8 لكل اتجاه (صغير وبطيء)', subacute: '2×10', strength: '2×12' },
    prog: 'بدون وزن ← بأوزان خفيفة جدًا (0.5–1 كجم).',
    video: 'arm circles shoulder warm up' },

  // ===== الرقبة =====
  { id: 'iso-neck', ar: 'تثبيت الرقبة ٤ اتجاهات', en: 'Isometric neck holds', pattern: 'iso', regions: ['neck'], phases: ['acute','subacute','strength'], section: 'main', tag: 'isometric',
    desc: 'دفع الرأس ضد اليد في 4 اتجاهات (أمام/خلف/يمين/شمال) بدون أي حركة فعلية للرقبة.',
    cues: ['الجهد خفيف 30–50% فقط', 'تنفس طبيعي أثناء الدفع', 'بدون ألم إطلاقًا'],
    dose: { acute: '5×8 ثوانٍ لكل اتجاه', subacute: '5×10 ثوانٍ', strength: '5×15 ثوانٍ' },
    prog: 'زِد زمن الإمساك ثم انتقل لمقاومة مطاط خفيف.',
    video: 'isometric neck strengthening exercises' },

  { id: 'chin-tuck', ar: 'سحب الذقن', en: 'Chin tuck', pattern: 'rom', regions: ['neck','shoulder'], phases: ['acute','subacute','strength'], section: 'main', tag: 'mobility',
    desc: 'سحب الذقن للخلف مباشرة لتقوية عضلات عمق الرقبة وتصحيح وضعية الرأس.',
    cues: ['كأنك تصنع "ذقن مزدوج"', 'حركة صغيرة وبطيئة', 'كتفان مسترخيان'],
    dose: { acute: '3×8 إمساك 5 ثوانٍ', subacute: '3×10', strength: '3×12' },
    prog: 'أدِّها استلقاءً ثم جلوسًا ثم وقوفًا.',
    video: 'chin tuck exercise neck posture' },

  { id: 'neck-stretch', ar: 'إطالات رقبية لطيفة', en: 'Gentle neck stretches', pattern: 'stretch', regions: ['neck'], phases: ['subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'إمالة الرأس جانبًا بلطف مع سند اليد لتحسين مرونة عضلات جانب الرقبة.',
    cues: ['اسحب بلطف شديد — لا شد عنيف', 'الإحساس بثقل بسيط فقط', '20–30 ثانية لكل جانب'],
    dose: { subacute: '2×30 ثانية لكل جانب', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'أضِف إمالة قطرية خفيفة بعد تحسن الأعراض.',
    video: 'gentle neck stretch upper trapezius' },

  // ===== الكتف =====
  { id: 'pendulum', ar: 'حركة البندول', en: 'Pendulum swings', pattern: 'rom', regions: ['shoulder'], phases: ['acute','subacute'], section: 'warmup', tag: 'rom',
    desc: 'أول حركة مسموحة غالبًا بعد إصابة الكتف: ترك الذراع تتدلى وتتحرك بحركة الجسم فقط.',
    cues: ['انحنِ قليلًا واسند يدك على طاولة', 'العضلة مسترخية تمامًا — حركة من الجذع', 'دوائر صغيرة 20–30 سم'],
    dose: { acute: '2×30 ثانية لكل اتجاه', subacute: '2×1 دقيقة' },
    prog: 'كبّر قطر الدوائر تدريجيًا قبل الانتقال لتمارين نشطة.',
    video: 'shoulder pendulum exercise' },

  { id: 'scap-squeeze', ar: 'ضم لوحي الكتف', en: 'Scapular squeeze', pattern: 'iso', regions: ['shoulder','chest_abs'], phases: ['acute','subacute','strength'], section: 'main', tag: 'isometric',
    desc: 'سحب الكتفين للخلف والأسفل كأنك تعصر قلمًا بينهما — أساس ثبات لوح الكتف.',
    cues: ['الكتفان بعيدان عن الأذنين', 'إمساك 5–10 ثوانٍ', 'الصدر مفتوح'],
    dose: { acute: '3×8 إمساك 5 ثوانٍ', subacute: '3×10 إمساك 8 ثوانٍ', strength: '3×12' },
    prog: 'من الجلوس إلى الوقوف ثم مع مطاط مقاومة خلف الظهر.',
    video: 'scapular retraction exercise' },

  { id: 'band-er', ar: 'دوران خارجي بمطاط', en: 'Band external rotation', pattern: 'band', regions: ['shoulder'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'تقوية العضلات الدوّارة للكتف — العضلة الأهم لثبات الكتف بعد الإصابة.',
    cues: ['منشفة ملفوفة تحت الإبط', 'الكوف ملتصق بالجسم', 'حركة بطيئة للخارج ثم رجوع متحكم'],
    dose: { subacute: '3×12 بمقاومة خفيفة', strength: '3×15', rtp: '3×15 بمقاومة أعلى' },
    prog: 'مقاومة خفيفة ← متوسطة ← الوقوف على ساق واحدة أثناء التمرين.',
    video: 'band external rotation rotator cuff' },

  { id: 'wall-slides', ar: 'انزلاق الذراع على الحائط', en: 'Wall slides', pattern: 'rom', regions: ['shoulder'], phases: ['subacute','strength'], section: 'main', tag: 'mobility',
    desc: 'تحسين المدى الحركي لرفع الذراع مع الحفاظ على تحكم لوح الكتف.',
    cues: ['الظهر ملاصق للحائط', 'انزلق للأعلى حتى قبل نقطة الألم', 'لا ترفع الكتفين'],
    dose: { subacute: '3×10', strength: '3×12' },
    prog: 'مع مطاط حول المعصمين لدفع خفيف للخارج.',
    video: 'wall slides shoulder mobility' },

  { id: 'prone-y', ar: 'رفع Y انبطاحًا', en: 'Prone Y raise', pattern: 'birddog', regions: ['shoulder','chest_abs'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'استلقاء على البطن ورفع الذراعين على شكل Y لتقوية عضلات ثبات الكتف السفلية.',
    cues: ['الإبهام للأعلى', 'ارفع من لوح الكتف لا من أسفل الظهر', 'حركة صغيرة تكفي'],
    dose: { strength: '3×10 إمساك 2 ثانية', rtp: '3×12' },
    prog: 'بدون وزن ← بأوزان صغيرة (0.5–2 كجم) ← على كرة أو مقعد.',
    video: 'prone Y raise shoulder exercise' },

  { id: 'wall-pushup', ar: 'ضغط على الحائط (تدرج)', en: 'Wall push-up progression', pattern: 'push', regions: ['shoulder','chest_abs'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'سلسلة ضغط متدرجة: حائط ← سطح مائل ← أرضية، لإعادة تحميل الكتف بأمان.',
    cues: ['الجسم خط مستقيم', 'المرفقان بزاوية 45° من الجسم', 'دفع قوي في النهاية'],
    dose: { subacute: '3×10 على الحائط', strength: '3×12 مائل', rtp: '3×10 أرضي' },
    prog: 'كلما زاد الاستقامة والألم صفر: حائط ← طاولة ← ركبتين ← قدمين.',
    video: 'wall push up progression shoulder' },

  { id: 'shoulder-stretch', ar: 'إطالة الكتف عبر الجسم', en: 'Cross-body shoulder stretch', pattern: 'stretch', regions: ['shoulder'], phases: ['subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'سحب الذراع عبر الصدر بإلآخرى لإطالة عضلة الكتف الخلفية.',
    cues: ['اسحب من فوق المرفق', 'الكتف مشدود للخلف', '30 ثانية خفيفة'],
    dose: { subacute: '2×30 ثانية لكل جهة', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'أضِف إطالة بحبل أو منشفة خلف الظهر بعد تحسن المدى.',
    video: 'cross body shoulder stretch' },

  // ===== المرفق والرسغ =====
  { id: 'wrist-rom', ar: 'حركات الرسغ والكوف', en: 'Wrist & elbow ROM', pattern: 'rom', regions: ['elbow','wrist'], phases: ['acute','subacute','strength'], section: 'warmup', tag: 'rom',
    desc: 'حركات دوران وثني وفرد للرسغ والكوف للاحتفاظ بالمدى الحركي.',
    cues: ['حركة داخل حدود الألم الصفر–1', 'بطيء ومتحكم', '8–10 تكرارات لكل اتجاه'],
    dose: { acute: '2×8 كل اتجاه', subacute: '2×10', strength: '2×10' },
    prog: 'أضِف وزنًا خفيفًا (0.5 كجم) عند اختفاء الألم.',
    video: 'wrist range of motion exercises' },

  { id: 'ecc-wrist', ar: 'خفض الرسغ اللامركزي', en: 'Eccentric wrist lowers', pattern: 'band', regions: ['elbow'], phases: ['subacute','strength'], section: 'main', tag: 'eccentric',
    desc: 'التمرين الأساسي لمرفق التنس: رفع بيد الأخرى ثم خفض بطيء جدًا (3–4 ثوانٍ).',
    cues: ['الخفض بطيء جدًا — العد 3 ثوانٍ', 'وزن خفيف جدًا (0.5–1 كجم)', 'ألم ≤ 2/10 مقبول'],
    dose: { subacute: '3×10', strength: '3×15 بوزن أكبر قليلًا' },
    prog: 'زِد الوزن ~10% أسبوعيًا إذا الأعراض مستقرة.',
    video: 'tennis elbow eccentric exercise wrist' },

  { id: 'grip-squeeze', ar: 'تمارين القبضة', en: 'Grip squeeze', pattern: 'iso', regions: ['wrist','elbow'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'isometric',
    desc: 'عصر كرة أو إسفنجة قبضة لتقوية عضلات الساعد والقبضة.',
    cues: ['عصر 5 ثوانٍ ثم إرخاء كامل', 'بدون ألم في المرفق', 'تنفس طبيعي'],
    dose: { subacute: '3×10 عصر', strength: '3×15', rtp: '3×15' },
    prog: 'كرة لينة ← صلبة ← مسدس قبضة (Grip set).',
    video: 'grip strength squeeze exercise' },

  // ===== الصدر والبطن (الجذع) =====
  { id: 'breathing-brace', ar: 'تنفس بطني مع تثبيت', en: '360° breathing + brace', pattern: 'iso', regions: ['chest_abs','lower_back'], phases: ['acute','subacute','strength'], section: 'warmup', tag: 'isometric',
    desc: 'أساس كل تمارين الجذع: شهيق يوسع الضلوع ثم شد خفيف لعضلات البطن كأنك تستعد لدفعة.',
    cues: ['الشهيق من الأنف 3 ثوانٍ — الزفير من الفم 5 ثوانٍ', 'الشد 20–30% فقط', 'الرقبة والكتفان مسترخيان'],
    dose: { acute: '2×5 أنفاس', subacute: '2×8 أنفاس', strength: '2×8 أنفاس' },
    prog: 'ادمجه مع رفع طرف واحد (حشرة ميتة مبسطة).',
    video: 'core breathing brace exercise' },

  { id: 'deadbug', ar: 'الحشرة الميتة', en: 'Dead bug', pattern: 'deadbug', regions: ['chest_abs','lower_back','hip'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'استلقاء على الظهر مع خفض الذراع والساق المقابلتين ببطء مع تثبيت الجذع.',
    cues: ['أسفل الظهر ملتصق بالأرض', 'خفض بطيء مع زفير', 'أوقف عند انفصال الظهر عن الأرض'],
    dose: { subacute: '3×8 لكل جانب', strength: '3×10', rtp: '3×12' },
    prog: 'حركة طرف واحد ← طرفان متقابلان ← مع حمل خفيف باليدين.',
    video: 'dead bug core exercise' },

  { id: 'bird-dog', ar: 'الكلب والطائر', en: 'Bird dog', pattern: 'birddog', regions: ['lower_back','hip','chest_abs'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'من وضع الأربع نقاط: فرد الذراع والساق المقابلتين مع ثبات تام للجذع.',
    cues: ['الحوض أفقي — لا يميل', 'ارفع الطرف لمستوى الجذع فقط', 'إمساك 3 ثوانٍ'],
    dose: { subacute: '3×8 لكل جانب', strength: '3×10', rtp: '3×10' },
    prog: 'من دون إمساك ← إمساك 5 ثوانٍ ← حرّك الطرفين برسم دائرة صغيرة.',
    video: 'bird dog exercise lower back' },

  { id: 'plank', ar: 'بلانك أمامي', en: 'Front plank', pattern: 'plank', regions: ['chest_abs','lower_back'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'isometric',
    desc: 'ثبات الجذع على الساعدين وأصابع القدم بخط مستقيم من الرأس للكعبين.',
    cues: ['اسحب السرة للداخل', 'المؤخرة بمستوى الظهر لا أعلى', 'تنفس — لا تحبس النفس'],
    dose: { subacute: '3×20 ثانية', strength: '3×40 ثانية', rtp: '3×60 ثانية' },
    prog: 'على الركبتين ← كامل ← رفع طرف ← مع لمس كتف متبادل.',
    video: 'front plank proper form' },

  { id: 'side-plank', ar: 'بلانك جانبي', en: 'Side plank', pattern: 'sideplank', regions: ['chest_abs','hip','lower_back','groin'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'isometric',
    desc: 'ثبات جانبي يقوي الجانب الجانبي للجذع — أساسي لثبات الحوض أثناء الجري.',
    cues: ['الكوف تحت الكتف مباشرة', 'ارفع الحوض حتى خط مستقيم', 'من الركبتين أولًا إن لزم'],
    dose: { subacute: '3×15 ثانية لكل جانب', strength: '3×30 ثانية', rtp: '3×45 ثانية' },
    prog: 'من الركبتين ← كامل ← رفع الساق العلوية ← على سطح غير مستقر.',
    video: 'side plank exercise progression' },

  { id: 'pallof', ar: 'ضغط بالوف بمطاط', en: 'Pallof press', pattern: 'band', regions: ['chest_abs','lower_back'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'مقاومة دوران بمطاط موصّل لجانبك — يقوي ثبات الجذع ضد التواء مفاجئ.',
    cues: ['امنع دوران الجذع بالكامل', 'مد الذراعين وإمساك 3 ثوانٍ', 'وقفة رياضية بثبات'],
    dose: { strength: '3×10 لكل جانب', rtp: '3×12' },
    prog: 'وقوف ← بساقين متباعدتين ثم متقاربتين ← بساق واحدة.',
    video: 'pallof press anti rotation' },

  // ===== أسفل الظهر =====
  { id: 'cat-camel', ar: 'القطة والجمل', en: 'Cat-camel', pattern: 'rom', regions: ['lower_back','hip'], phases: ['acute','subacute','strength','rtp'], section: 'warmup', tag: 'mobility',
    desc: 'تدوير تدريجي للعمود الفقري من وضع الأربع نقاط — إحماء ممتاز للظهر.',
    cues: ['حركة بطيئة مع التنفس', 'دائرة كاملة بدون رجفان', 'المدى المريح فقط'],
    dose: { acute: '2×8 دورات', subacute: '2×10', strength: '1×10 كإحماء', rtp: '1×10 كإحماء' },
    prog: 'هو تمرين تحضيري — لا يحتاج تصعيدًا، فقط مدى أكبر مع الوقت.',
    video: 'cat camel stretch spine' },

  { id: 'glute-bridge', ar: 'جسر الأرداف', en: 'Glute bridge', pattern: 'bridge', regions: ['hip','lower_back','hamstring'], phases: ['acute','subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'رفع الحوض من الاستلقاء بالدفع من الكعبين — تفعيل الألوية وحماية الظهر.',
    cues: ['ادفع من الكعبين', 'اضغط الألوية في الأعلى إمساك 3 ثوانٍ', 'لا تقوّس أسفل الظهر'],
    dose: { acute: '3×10 إمساك 3 ثوانٍ', subacute: '3×12', strength: '3×15 أو بحمل', rtp: '3×15' },
    prog: 'إمساك أطول ← بساق واحدة ← مع مطاط فوق الركبتين ← بحمل على الحوض.',
    video: 'glute bridge exercise' },

  { id: 'hip-hinge', ar: 'مفصلة الورك بعصا', en: 'Hip hinge (dowel)', pattern: 'hinge', regions: ['lower_back','hamstring','hip'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'تعلم الانحناء الصحيح من الورك بظهر مستقيم — المهارة الحمائية الأساسية للظهر.',
    cues: ['عصا على الظهر تلامس الرأس والمنتصف والعُجز', 'ادفع المؤخرة للخلف', 'الركبتان بثني بسيط'],
    dose: { strength: '3×10', rtp: '3×10 ثم مع حمل خفيف' },
    prog: 'عصا فقط ← مع حمل خفيف ← رفعة رومانية بحاملين.',
    video: 'hip hinge exercise dowel' },

  { id: 'sl-bridge', ar: 'جسر بساق واحدة', en: 'Single-leg bridge', pattern: 'bridge', regions: ['hip','hamstring','lower_back'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'جسر على ساق واحدة لزيادة تحميل الألوية والمأبضية مع تحدي الثبات.',
    cues: ['الحوض أفقي — لا ينخفض جهة واحدة', 'الساق المرفوعة ثابتة', 'إمساك 2 ثانية في الأعلى'],
    dose: { strength: '3×8 لكل ساق', rtp: '3×10' },
    prog: 'عادية ← بساق واحدة ← الساق المرفوعة على صدرك ← بحمل.',
    video: 'single leg glute bridge' },

  { id: 'child-pose', ar: 'وضع الطفل', en: 'Child\u2019s pose', pattern: 'stretch', regions: ['lower_back','hip'], phases: ['acute','subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'جلوس على الكعبين مع مد الذراعين للأمام — إطالة مريحة لأسفل الظهر.',
    cues: ['تنفس عميق في ظهرك', 'ابعد الركبتين أوسع إن كان مريحًا', '30–60 ثانية'],
    dose: { acute: '1–2×30 ثانية', subacute: '2×45 ثانية', strength: '2×45 ثانية', rtp: '2×45 ثانية' },
    prog: 'أضِف دوران جذع خفيف باليد في النهاية.',
    video: 'childs pose lower back stretch' },

  // ===== الورك والأرداف =====
  { id: 'clamshell', ar: 'المحارة', en: 'Clamshell', pattern: 'iso', regions: ['hip'], phases: ['acute','subacute','strength'], section: 'main', tag: 'isometric',
    desc: 'فتح الركبة العلوية كصدفة محارة والاستلقاء الجانبي — تنشيط العضلة الألوية الوسطى.',
    cues: ['الحوض ثابت — لا يدور للخلف', 'الكعبان ملتصقان', 'حركة صغيرة نوعية'],
    dose: { acute: '3×10', subacute: '3×12', strength: '3×15 بمطاط' },
    prog: 'بدون مطاط ← بمطاط فوق الركبتين ← بأزمة أثقال خفيفة.',
    video: 'clamshell exercise glutes' },

  { id: 'side-abd', ar: 'رفع جانبي من الاستلقاء', en: 'Side-lying hip abduction', pattern: 'sideleg', regions: ['hip'], phases: ['subacute','strength'], section: 'main', tag: 'strength',
    desc: 'رفع الساق العلوية مستقيمة من الاستلقاء الجانبي لتقوية جانب الورك.',
    cues: ['الساق ممدودة وإصبع القدم للأمام', 'ارفع 30–45° فقط', 'بدون دوران الحوض'],
    dose: { subacute: '3×10 لكل ساق', strength: '3×12' },
    prog: 'أضِف مطاط حول الفخذين ← أثقال كاحل خفيفة.',
    video: 'side lying hip abduction exercise' },

  { id: 'band-walk', ar: 'مشي الوحش بمطاط', en: 'Lateral band walk', pattern: 'band', regions: ['hip','groin','knee'], phases: ['strength','rtp'], section: 'warmup', tag: 'strength',
    desc: 'خطوات جانبية بمطاط حول الكاحلين أو الفخذين — من أفضل إحماءات الألوية.',
    cues: ['وضع رياضي بثني ركبتين', 'خطوات صغيرة ومتوترة', 'مطاط مشدود باستمرار'],
    dose: { strength: '3×10 خطوة لكل جهة', rtp: '3×12' },
    prog: 'مطاط حول الركبتين ← حول الكاحلين ← بوضع منخفض.',
    video: 'lateral band walk glute exercise' },

  { id: 'rot-9090', ar: 'دورانات 90/90', en: '90/90 hip rotations', pattern: 'rom', regions: ['hip','groin'], phases: ['subacute','strength','rtp'], section: 'warmup', tag: 'mobility',
    desc: 'تحسين الدوران الداخلي والخارجي للورك من الجلوس — مفيد جدًا للقفز والتغيير الاتجاهي.',
    cues: ['الركبتان 90° والجلوس منتصب', 'أدِر الركبتين معًا ببطء', 'يدان خلف الجسم للسند'],
    dose: { subacute: '2×8 لكل جهة', strength: '2×10', rtp: '2×10' },
    prog: 'بدون إمساك ← إمساك 5 ثوانٍ في نهاية المدى.',
    video: '90 90 hip mobility exercise' },

  { id: 'hf-stretch', ar: 'إطالة باسطة الورك', en: 'Hip flexor stretch', pattern: 'stretch', regions: ['hip','lower_back','quad'], phases: ['acute','subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'طعن منخفض بإسناد الركبة لإطالة عضلات أمام الورك المتقصّرة من الجلوس الطويل.',
    cues: ['اضغط الألوية في الجهة الممدودة', 'الحوض تحت قليلًا — لا تقوّس الظهر', '30 ثانية لكل جهة'],
    dose: { acute: '2×20 ثانية', subacute: '2×30 ثانية', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'من الركبتين ← وقوف ← برفع الذراع لدوران جانبي.',
    video: 'hip flexor stretch kneeling' },

  { id: 'glute-stretch', ar: 'إطالة الألوية (رقم ٤)', en: 'Figure-4 glute stretch', pattern: 'stretch', regions: ['hip','lower_back'], phases: ['subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'سحب الركبة نحو الصدر بوضع رقم ٤ لإطالة عمق الأرداف (الكمثرية).',
    cues: ['اسحب من خلف الفخذ', 'الرأس والكتفان على الأرض', '30 ثانية بدون شد عصبي'],
    dose: { subacute: '2×30 ثانية لكل جهة', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'من الاستلقاء ← الجلوس (حمامة معدلة).',
    video: 'figure 4 glute stretch' },

  // ===== العضلات الضامّة (أداخل الفخذ) =====
  { id: 'add-squeeze', ar: 'ضغط كرة بين الركبتين', en: 'Adductor ball squeeze', pattern: 'ball', regions: ['groin','hip'], phases: ['acute','subacute','strength'], section: 'main', tag: 'isometric',
    desc: 'إيسومتريك آمن للضامّة: عصر كرة بين الركبتين والاستلقاء مع ثني الركبتين.',
    cues: ['عصر 5–10 ثوانٍ بجهد متوسط', 'تنفس أثناء العصر', 'ابدأ جهد 30% وزِده'],
    dose: { acute: '5×8 ثوانٍ', subacute: '5×10 ثوانٍ', strength: '5×15 ثوانٍ' },
    prog: 'جهد أقل ← أعلى ← استلقاء بزاوية مائلة لزيادة المدى.',
    video: 'adductor squeeze ball exercise' },

  { id: 'sl-adduction', ar: 'جمع من الاستلقاء الجانبي', en: 'Side-lying adduction', pattern: 'sideleg', regions: ['groin'], phases: ['subacute','strength'], section: 'main', tag: 'strength',
    desc: 'رفع الساق السفلية من الأرض والاستلقاء الجانبي — تحميل مباشر للضامّة.',
    cues: ['الساق العلوية مثنية للأمام للسند', 'ارفع الساق السفلية ببطء', 'حركة قصيرة متحكم بها'],
    dose: { subacute: '3×10', strength: '3×12' },
    prog: 'أضِف أوزان كاحل خفيفة جدًا مع الوقت.',
    video: 'side lying adduction exercise' },

  { id: 'copenhagen', ar: 'كوبنهاجن تدريجي', en: 'Copenhagen plank progression', pattern: 'sideplank', regions: ['groin','hip'], phases: ['strength','rtp'], section: 'main', tag: 'isometric',
    desc: 'بلانك جانبي والساق العلوية على مقعد — التمرين الأقوى علميًا للوقاية من إصابات الضامّة.',
    cues: ['ابدأ بالساق على الركبة ثم امدها', 'الحوض في خط واحد', 'إمساك 10–20 ثانية'],
    dose: { strength: '3×10–15 ثانية لكل جهة', rtp: '3×20 ثانية' },
    prog: 'على الركبة ← على القدم ← مع حركة جمع وإنزال متكررة.',
    video: 'copenhagen adductor plank progression' },

  { id: 'side-lunge', ar: 'لانج جانبي', en: 'Side lunge', pattern: 'lunge', regions: ['groin','quad','hip'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'خطوة جانبية بثني ركبة واحدة وتحميل الضامّة والورك في وضع وظيفي.',
    cues: ['القدم المستقيمة أرضية كاملة', 'ادفع من الكعب للرجوع', 'الصدر مرفوع'],
    dose: { strength: '3×8 لكل جهة', rtp: '3×10' },
    prog: 'مدى قصير ← كامل ← مع حمل خفيف ← بحركة متسارعة.',
    video: 'side lunge exercise' },

  { id: 'add-stretch', ar: 'إطالة الضامّة (الفراشة)', en: 'Butterfly adductor stretch', pattern: 'stretch', regions: ['groin','hip'], phases: ['acute','subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'الجلوس وأقدام متقابلة مع خفض الركبتين بلطف لإطالة داخل الفخذ.',
    cues: ['اسحب من الفخذ لا من الركبة', 'ظهر مستقيم وانحناء من الورك', '30 ثانية هادئة'],
    dose: { acute: '2×20 ثانية (خفيف جدًا)', subacute: '2×30 ثانية', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'أضِف إطالة جانبية بساق ممدودة بعد تحسن الأعراض.',
    video: 'butterfly stretch adductor' },

  // ===== أمامية الفخذ والركبة =====
  { id: 'quad-set', ar: 'تثبيت الأمامية (سحق منشفة)', en: 'Quad set', pattern: 'iso', regions: ['quad','knee'], phases: ['acute','subacute'], section: 'main', tag: 'isometric',
    desc: 'شد عضلة الفخذ الأمامية بضغط الركبة على منشفة مدورة — أول تمرين بعد إصابة الركبة.',
    cues: ['اضغط ركبتك للأسفل على المنشفة', 'شد 5 ثوانٍ ثم استرخاء كامل', 'بدون ألم تحت الرضفة'],
    dose: { acute: '10×5 ثوانٍ (كل ساعة إذا ممكن)', subacute: '3×10' },
    prog: 'منشفة أكبر ← مدة أطول ← مع رفع الساق المستقيمة بعدها مباشرة.',
    video: 'quad set exercise knee' },

  { id: 'heel-slide', ar: 'انزلاق الكعب', en: 'Heel slide', pattern: 'rom', regions: ['knee'], phases: ['acute','subacute'], section: 'warmup', tag: 'rom',
    desc: 'استرجاع ثني الركبة بسحب الكعب نحو الجسم باستخدام الحزام أو اليد.',
    cues: ['بطيء — انزل حتى قبل الألم', 'لا تجبر المفصل أبدًا', 'توقف 3 ثوانٍ في نهاية المدى'],
    dose: { acute: '3×8 (المدى المسموح)', subacute: '3×10 بمدى أكبر' },
    prog: 'بيدك ← بحزام ← انزلاق نشط ← على سطح ملساء بتقنية انزلاق.',
    video: 'heel slide knee exercise' },

  { id: 'slr', ar: 'رفع الساق المستقيمة', en: 'Straight leg raise', pattern: 'deadbug', regions: ['quad','knee','hip'], phases: ['acute','subacute','strength'], section: 'main', tag: 'strength',
    desc: 'رفع ساق ممدودة والاستلقاء مع تثبيت الركبة — يبني قوة أمامية الفخذ بدون تحميل مفصلي.',
    cues: ['ركبة مشدودة كاملة قبل الرفع', 'ارفع 30–45° فقط', 'خفض بطيء جدًا'],
    dose: { acute: '3×10', subacute: '3×12', strength: '3×15 بأوزان كاحل' },
    prog: 'بدون وزن ← أوزان كاحل ← مع إمالة خارجية للساق (VMO).',
    video: 'straight leg raise exercise' },

  { id: 'tkte', ar: 'فرد الركبة النهائي بمطاط', en: 'Terminal knee extension (band)', pattern: 'band', regions: ['knee','quad'], phases: ['subacute','strength'], section: 'main', tag: 'strength',
    desc: 'مطاط خلف الركبة تدفع ضد الوركة لتفعيل الأمامية في آخر درجات الفرد.',
    cues: ['ادفع الركبة للخلف للفرد الكامل', 'حركة صغيرة ومتحكم بها', 'إمساك 2 ثوانٍ مفرودًا'],
    dose: { subacute: '3×12', strength: '3×15' },
    prog: 'بمطاط خفيف ← أثقل ← بساق واحدة على منصة صغيرة.',
    video: 'terminal knee extension band exercise' },

  { id: 'spanish-squat', ar: 'سكوات إسباني', en: 'Spanish squat', pattern: 'iso', regions: ['quad','knee'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'isometric',
    desc: 'حزام خلف الركبة على حائط وتحميل الأمامية إيسومتريًا — ممتاز لوتر الرضفة.',
    cues: ['تميل للخلف وينشد الحزام', 'زاوية ركبة مريحة غير مؤلمة', 'إمساك 30–45 ثانية'],
    dose: { subacute: '5×30 ثانية', strength: '5×45 ثانية', rtp: '5×45 ثانية بساق واحدة' },
    prog: 'إيسومتريك ← قرفصاء بطيئة بنفس الوضع ← بحمل إضافي.',
    video: 'spanish squat isometric patellar' },

  { id: 'wall-sit', ar: 'الجلوس على الحائط', en: 'Wall sit', pattern: 'iso', regions: ['quad','knee'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'isometric',
    desc: 'جلوس على حائط بزاوية مريحة لبناء تحمل الأمامية تدريجيًا.',
    cues: ['ابدأ بزاوية 60° ثم قللها مع الوقت', 'الظهر ملتصق بالحائط', 'الكعبان تحت الركبتين'],
    dose: { subacute: '3×20–30 ثانية', strength: '3×45 ثانية', rtp: '3×60 ثانية' },
    prog: 'زاوية أكبر ← أصغر ← بساق واحدة ← مع حمل على الفخذين.',
    video: 'wall sit exercise' },

  { id: 'box-squat', ar: 'قرفصاء على صندوق (تدرج)', en: 'Box squat progression', pattern: 'squat', regions: ['quad','knee','hip','lower_back'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'قرفصاء بجلسة خلفك تضمن العمق الآمن وتدرج التحميل على الركبة.',
    cues: ['اجلس برفق ثم انهض بدون مرتدة', 'الركبة باتجاه أصابع القدم', 'العمق بدون ألم فقط'],
    dose: { strength: '3×10', rtp: '3×12 بعمق أكبر أو حمل' },
    prog: 'صندوق عالٍ ← منخفض ← بدون صندوق ← مع حمل ← بساق واحدة.',
    video: 'box squat exercise knee rehab' },

  { id: 'step-up', ar: 'الصعود على درجة', en: 'Step-up', pattern: 'stepup', regions: ['quad','knee','hip','ankle'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'صعود على درجة بالساق المصابة وهبوط متحكم — وظيفي جدًا للعودة.',
    cues: ['ابدأ بدرجة 15–20 سم', 'ادفع من الساق العلوية ولا تدفع بالسفلية', 'هبوط بطيء 3 ثوانٍ'],
    dose: { strength: '3×8 لكل ساق', rtp: '3×10 بدرجة أعلى' },
    prog: 'درجة منخفضة ← عالية ← مع حمل ← مع ركبة استقبال (Step-down).',
    video: 'step up exercise knee rehab' },

  { id: 'split-squat', ar: 'سكوات منفصل', en: 'Split squat', pattern: 'lunge', regions: ['quad','knee','hip'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'وضع طعن ثابت والنزول على الساق الأمامية — تحميل واحد بثبات عالٍ.',
    cues: ['الجذع منتصب مع ميل بسيط للأمام', 'الركبة الخلفية نحو الأرض', 'الكعب الأمامي ثابت'],
    dose: { strength: '3×8 لكل ساق', rtp: '3×10' },
    prog: 'بدون حمل ← دمبل ← ساق خلفية مرتفعة (Bulgarian).',
    video: 'split squat exercise' },

  { id: 'quad-stretch', ar: 'إطالة أمامية الفخذ وقوفًا', en: 'Standing quad stretch', pattern: 'stretch', regions: ['quad','knee'], phases: ['subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'سحب الكعب نحو المؤخرة وقوفًا مع سند لإطالة أمام الفخذ.',
    cues: ['الركبتان متلاصقتان', 'الحوض للخلف قليلًا', '30 ثانية لكل جهة'],
    dose: { subacute: '2×30 ثانية', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'وقوف ← استلقاء على الحافة مع هبوط القدم للخلف.',
    video: 'standing quad stretch' },

  // ===== خلفية الفخذ =====
  { id: 'ham-iso-bridge', ar: 'إيسومتريك سحب الكعبين', en: 'Hamstring iso bridge pull', pattern: 'bridge', regions: ['hamstring'], phases: ['subacute','strength'], section: 'main', tag: 'isometric',
    desc: 'جسر والكعبان على منشفة تسحبها نحوك — تفعيل المأبضية بدون ثني سريع.',
    cues: ['ارفع الحوض وسحب المنشفة معًا', 'إمساك 5–10 ثوانٍ', 'جهد متوسط بدون تشنج'],
    dose: { subacute: '5×8 ثوانٍ', strength: '5×15 ثوانٍ' },
    prog: 'جهد أقل ← أعلى ← ساق واحدة ← مع مطاط حول الكعبين.',
    video: 'hamstring isometric bridge towel pull' },

  { id: 'bridge-walkout', ar: 'جسر بتدحرج الكعبين', en: 'Bridge walkout', pattern: 'bridge', regions: ['hamstring','hip'], phases: ['subacute','strength'], section: 'main', tag: 'strength',
    desc: 'جسر ثم دفع الكعبين بعيدًا قليلًا ورجوع — يمدّد المأبضية تحت تحميل خفيف.',
    cues: ['الوصول قبل نقطة الألم/التشنج', 'حركة بطيئة 3 ثوانٍ للخارج', 'الحوض مرفوع باستمرار'],
    dose: { subacute: '3×8', strength: '3×10 بمدى أوسع' },
    prog: 'مدى صغير ← أكبر ← بساق واحدة (مستوى متقدم).',
    video: 'hamstring bridge walkout slider' },

  { id: 'nordic', ar: 'النورديك تدريجيًا', en: 'Nordic hamstring curl progression', pattern: 'hinge', regions: ['hamstring'], phases: ['strength','rtp'], section: 'main', tag: 'eccentric',
    desc: 'التمرين الأقوى لخفض إصابات المأبضية ~50%: هبوط بطيء للجسم من الركبتين ثم دفع للرجوع.',
    cues: ['ابدأ بمدى صغير جدًا', 'الهبوط 3–5 ثوانٍ ثم ادفع باليدين', 'الجسم خط مستقيم'],
    dose: { strength: '3×3–5 تكرارات قصيرة', rtp: '3×6 بمدى أوسع' },
    prog: 'مدى صغير مع سند الحبل ← مدى أكبر ← بشريك يشد كاحليك.',
    video: 'nordic hamstring curl progression' },

  { id: 'sl-rdl', ar: 'روماني بساق واحدة', en: 'Single-leg RDL', pattern: 'hinge', regions: ['hamstring','hip','lower_back'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'انحناء من الورك بساق واحدة والساق الحرة ممدودة — قوة وتوازن للمأبضية.',
    cues: ['ظهر مستقيم — الحركة من الورك', 'الساق الحرة في امتداد الجسم', 'حمل خفيف في البداية'],
    dose: { strength: '3×8 لكل ساق', rtp: '3×10 بحمل' },
    prog: 'بدون حمل ← دمبل/كيتلبل ← بحمل أعلى وثبات أطول.',
    video: 'single leg romanian deadlift' },

  { id: 'ham-stretch', ar: 'إطالة المأبضية بحزام', en: 'Strap hamstring stretch', pattern: 'stretch', regions: ['hamstring','knee'], phases: ['acute','subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'استلقاء ورفع ساق ممدودة بحزام لإطالة خلفية الفخذ بشكل آمن ومتحكم.',
    cues: ['الركبة شبه مفرودة لا مقفولة', 'اسحب حتى شد خفيف فقط', '30 ثانية مع تنفس هادئ'],
    dose: { acute: '2×20 ثانية خفيفة جدًا', subacute: '2×30 ثانية', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'بالحزام ← بدفع نشط من الحزام (PNF مبسط) بعد الأسبوع الأول.',
    video: 'supine hamstring stretch strap' },

  // ===== بطة الساق ووأكيليس =====
  { id: 'iso-calf', ar: 'إيسومتريك دفع البطة', en: 'Isometric calf push', pattern: 'iso', regions: ['calf'], phases: ['acute','subacute'], section: 'main', tag: 'isometric',
    desc: 'دفع مقدمة القدم ضد حائط أو جد بساق ممدودة — أول تمرين بعد شد البطة.',
    cues: ['دفع 40–50% من القوة', 'إمساك 10 ثوانٍ', 'بدون ألم في الوتر'],
    dose: { acute: '5×10 ثوانٍ', subacute: '5×15 ثوانٍ' },
    prog: 'جهد أخف ← أثقل ← انتقل لرفع الكعب الكامل.',
    video: 'isometric calf exercise wall' },

  { id: 'calf-raise', ar: 'رفع الكعبين بساقين', en: 'Calf raise (both legs)', pattern: 'calfraise', regions: ['calf','ankle'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'رفع الكعبين من وقوف ثابت مع سند — الأساس لإعادة بناء قوة البطة.',
    cues: ['ارفع لأقصى ارتفاع ممكن', 'انزل بطيء 3 ثوانٍ', 'سند بإصبع على حائط'],
    dose: { subacute: '3×12', strength: '3×15', rtp: '3×20' },
    prog: 'بساقين ← بساق واحدة ← على درجة بمدى أكبر ← بحمل.',
    video: 'calf raise exercise' },

  { id: 'sl-calf', ar: 'رفع الكعب بساق واحدة', en: 'Single-leg calf raise', pattern: 'calfraise', regions: ['calf','ankle'], phases: ['strength','rtp'], section: 'main', tag: 'strength',
    desc: 'نفس رفع الكعب بساق واحدة — المعيار العملي لجاهزية البطة قبل العودة.',
    cues: ['حافظ على استقامة الكاحل', 'أصابع القدم للأمام', 'مدى كامل أعلى وأسفل'],
    dose: { strength: '3×10 لكل ساق', rtp: '3×12 بحمل خفيف' },
    prog: 'أرضي ← على درجة ← بحمل دمبل ← عدّ تكراراتك وقارن بالساق السليمة.',
    video: 'single leg calf raise' },

  { id: 'heel-drop', ar: 'خفض الكعب اللامركزي على درجة', en: 'Eccentric heel drop', pattern: 'calfraise', regions: ['calf'], phases: ['strength','rtp'], section: 'main', tag: 'eccentric',
    desc: 'الوقوف على حافة درجة والخفض البطيء — العلاج الأساسي لالتهاب الوأكيليس.',
    cues: ['خفض 3–4 ثوانٍ ثم رجوع بالساق السليمة', 'ركبة مفرودة (وتر أعمق) ثم مثنية', 'ألم ≤ 3/10 مقبول'],
    dose: { strength: '3×12 لكل وضع', rtp: '3×15' },
    prog: 'بساقين ← بساق واحدة ← مع حقيبة ظهر بحمل تدريجي.',
    video: 'eccentric heel drop achilles' },

  { id: 'calf-stretch', ar: 'إطالة البطة على الحائط', en: 'Wall calf stretch', pattern: 'stretch', regions: ['calf','ankle'], phases: ['acute','subacute','strength','rtp'], section: 'cooldown', tag: 'mobility',
    desc: 'دفع جدار بقدم خلفية مفرودة الركبة لإطالة البطة، ثم بركبة مثنية للسولس.',
    cues: ['الكعب الخلفي ملتصق بالأرض', 'وضعان: ركبة مفرودة ثم مثنية', '30 ثانية لكل وضع'],
    dose: { acute: '2×20 ثانية خفيفة', subacute: '2×30 ثانية', strength: '2×30 ثانية', rtp: '2×30 ثانية' },
    prog: 'بدون معدات ← على حافة درجة بعد تحسن المرونة.',
    video: 'calf stretch wall gastrocnemius soleus' },

  // ===== الكاحل والقدم =====
  { id: 'ankle-abc', ar: 'أبجدية الكاحل', en: 'Ankle alphabet', pattern: 'rom', regions: ['ankle'], phases: ['acute','subacute'], section: 'warmup', tag: 'rom',
    desc: 'رسم حروف الأبجدية بحركة القدم فقط — استرجاع مدى الكاحل بلا حمل.',
    cues: ['حركة من الكاحل لا من الركبة', 'حروف كبيرة وبطيئة', 'بدون ألم متزايد'],
    dose: { acute: 'حرفان–3 مرات يوميًا', subacute: 'الأبجدية كاملة مرتين' },
    prog: 'بدون مقاومة ← مع مطاط خفيف حول القدم.',
    video: 'ankle alphabet range of motion' },

  { id: 'band-ankle', ar: 'مطاط الكاحل ٤ اتجاهات', en: '4-way ankle band', pattern: 'band', regions: ['ankle'], phases: ['subacute','strength'], section: 'main', tag: 'strength',
    desc: 'مقاومة مطاطية للتحريك للأعلى/الأسفل/الخارج/الداخل — تقوية شاملة للكاحل.',
    cues: ['الحركة من الكاحل فقط', 'بطيء ومتحكم 2 ثانية لكل اتجاه', 'بدون ألم حاد'],
    dose: { subacute: '3×12 لكل اتجاه', strength: '3×15' },
    prog: 'مطاط خفيف ← متوسط ← بساق أعلى (منتصف الوقوف).',
    video: 'resistance band ankle exercises four way' },

  { id: 'sl-balance', ar: 'توازن بساق واحدة', en: 'Single-leg balance', pattern: 'balance', regions: ['ankle','knee','hip'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'balance',
    desc: 'الوقوف على الساق المصابة — أهم تمرين لاستعادة الإحساس العميق بعد التواء الكاحل.',
    cues: ['ابدأ بجانب جد للسند', 'عيّن نقطة ثابتة أمامك', 'تدرج: عيون مفتوحة ← مغلقة'],
    dose: { subacute: '3×30 ثانية', strength: '3×45 ثانية + عيون مغلقة', rtp: '3×60 ثانية' },
    prog: 'أرض ثابتة ← إسفنجة/وسادة ← مع رمي كرة على حائط ← مع إزعاج خفيف.',
    video: 'single leg balance ankle rehabilitation' },

  { id: 'balance-unstable', ar: 'توازن على سطح متحرك', en: 'Unstable surface balance', pattern: 'balance', regions: ['ankle','knee'], phases: ['strength','rtp'], section: 'main', tag: 'balance',
    desc: 'توازن على وسادة توازن أو إسفنجة — يطور استجابة عضلات الكاحل السريعة.',
    cues: ['السند قريب دائمًا في البداية', 'حاول ثبات 45 ثانية', 'أضِف حركة ذراع تدريجيًا'],
    dose: { strength: '3×45 ثانية', rtp: '3×60 ثانية مع رمي/استقبال' },
    prog: 'سطحين ← أبعد ← مع رمي كرة أو تغيير ذراع.',
    video: 'balance pad ankle proprioception exercise' },

  { id: 'toe-raise', ar: 'رفع المشط (القدم القصيرة)', en: 'Toe raise / short foot', pattern: 'calfraise', regions: ['ankle'], phases: ['subacute','strength','rtp'], section: 'main', tag: 'strength',
    desc: 'رفع مقدمة القدم مع بقاء الكعب — يقوي عضلات قوس القدم ويحسّن الثبات.',
    cues: ['الكعب ثابت على الأرض', 'ارفع المشط وأصابع القدم', 'حركة صغيرة نوعية'],
    dose: { subacute: '3×12', strength: '3×15', rtp: '3×15' },
    prog: 'بساقين ← بساق واحدة ← مع مطاط حول أصابع القدم.',
    video: 'toe raise short foot exercise' },

  { id: 'hop-prog', ar: 'تدرج القفز على الساق', en: 'Hop progression', pattern: 'jump', regions: ['ankle','knee','calf'], phases: ['rtp'], section: 'main', tag: 'plyo',
    desc: 'سلسلة قفز: على مكان ← أمام/خلف ← جانبية ← مربعات — اختبار وتمرين جاهزية الكاحل.',
    cues: ['هبوط ناعم على مشط القدم', 'بدون ألم أو تورم بعدها', 'ابدأ بساق السليمة للتعلم'],
    dose: { rtp: '3×8 قفزات لكل نمط' },
    prog: 'قفز ثنائي ← قفزة واحدة ← بمسافة ← مع تغيير اتجاه مفاجئ.',
    video: 'hop progression ankle rehab' },

  // ===== العودة للملاعب (متعدد المناطق) =====
  { id: 'jog-prog', ar: 'تدرج العدو (مشي ← جري)', en: 'Walk-jog progression', pattern: 'agility', regions: ['knee','ankle','calf','hamstring','quad','hip','groin'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'بروتوكول تدرج زمني: مشي ← جري خفيف متقطع ← جري متصل — لا تزيد خطوة كل 2–3 أيام إذا الأعراض صفر.',
    cues: ['خطوة لكل مستوى: 10 دقائق جري متقطع ثم متصل', 'راقب الألم صباح اليوم التالي', 'توقف عند أي عرج'],
    dose: { rtp: '10–20 دقيقة حسب المستوى، 3 مرات أسبوعيًا' },
    prog: 'مستوى 1: مشي/جري 1:2 ← مستوى 2: 1:1 ← مستوى 3: جري متصل ← إضافة سرعة.',
    video: 'return to running progression rehab' },

  { id: 'change-dir', ar: 'تغيير الاتجاه (Cone drills)', en: 'Change of direction drills', pattern: 'agility', regions: ['knee','ankle','hip','groin','quad','hamstring'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'حركات بين أقماع: 5-10-5، أرقام 8، وتوقف مفاجئ — أهم مهارة قبل العودة للمباريات.',
    cues: ['ابدأ بـ70% سرعة', 'خفض مركز الجسم عند التوقف', 'التوقف بالقدمين معًا أولًا'],
    dose: { rtp: '4–6 جولات × 20 ثانية عمل / راحة 40 ثانية' },
    prog: 'خطوط مستقيمة ← زوايا ← توقفات مفاجئة ← بضغط زمني كامل.',
    video: 'change of direction drills cones soccer' },

  { id: 'jump-land', ar: 'قفز وهبوط متحكم', en: 'Jump and land mechanics', pattern: 'jump', regions: ['knee','ankle','hip','quad','calf'], phases: ['rtp'], section: 'main', tag: 'plyo',
    desc: 'تدريب آلية الهبوط الصحيحة: نزول ناعم على مشط القدم وركبتان بمحاذاة القدم.',
    cues: ['الهبوط صامت قدر الإمكان', 'الركبة لا تنهار للداخل', 'توقف ثابت 2 ثوانٍ بعد الهبوط'],
    dose: { rtp: '3×8 قفزة عمودية ثم قفزة أمامية' },
    prog: 'قفزة عمودية ← أمامية ← على صندوق ← بقفزة واحدة وتوقف مفاجئ.',
    video: 'jump landing mechanics training' },

  { id: 'decel', ar: 'تسارع وتوقف مفاجئ', en: 'Acceleration-deceleration runs', pattern: 'agility', regions: ['knee','ankle','hamstring','quad','hip'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'عدو 15–20 مترًا بتسارع ثم توقف متحكم — يختبر تحمل المأبضية والركبة الواقعي.',
    cues: ['ابدأ بـ75% ثم ارفع', 'التوقف بخطوات قصيرة متتالية', 'استرخاء كامل بين الجولات'],
    dose: { rtp: '6–8 تكرارات، راحة 60–90 ثانية' },
    prog: 'تسارع 75% ← 90% ← سرعة كاملة مع كرة (مهارة خاصة بمركزك).',
    video: 'acceleration deceleration sprint training' },

  // ===== تمارين وظيفية متقدمة (المرحلة ٤ — العودة للملاعب) =====
  { id: 'sprint-prog', ar: 'تدرج السرعة القصوى', en: 'Max speed sprint progression', pattern: 'agility', regions: ['hamstring','quad','calf','knee','hip','groin'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'الخطوة الأخيرة قبل المباراة: سبرنتات بسرعة متدرجة 80% ← 90% ← 100% مع راحة كاملة — أعلى تحميل للمأبضية وأكثر ما يحمي من الانتكاس.',
    cues: ['لا ترفع السرعة إلا بعد يومين بدون أعراض', 'الجري متوتر الطول 30–40 مترًا', 'راحة كاملة 2–3 دقائق بين الجولات'],
    dose: { rtp: '6–10 سبرنت × 30 متر حسب المستوى' },
    prog: '80% ← 90% ← 100% ← سبرنت بتسديدة أو استقبال (قرار رياضي).',
    video: 'sprint progression rehab hamstring return to play' },

  { id: 'ladder-agility', ar: 'سلم الرشاقة', en: 'Agility ladder drills', pattern: 'agility', regions: ['ankle','knee','hip','quad','groin'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'خطوات سريعة بين درجات السلم بأنماط متعددة — يطور الرشاقة وسرعة استجابة الكاحل والورك.',
    cues: ['ابدأ بنمط واحد بطيء ثم زد السرعة', 'مقدمة القدم فقط تلمس الأرض', 'الجذع ثابت والعينان للأمام'],
    dose: { rtp: '4–6 أنماط × جولتين' },
    prog: 'نمط واحد ← أنماط جانبية ← مع استقبال كرة في النهاية.',
    video: 'agility ladder drills soccer rehab' },

  { id: 'sl-land', ar: 'هبوط على ساق واحدة', en: 'Single-leg landing', pattern: 'jump', regions: ['knee','ankle','hip'], phases: ['rtp'], section: 'main', tag: 'plyo',
    desc: 'قفزة ثم هبوط ثابت على الساق المصابة — المعيار العملي لجاهزية الركبة قبل العودة.',
    cues: ['الهبوط صامت ومتحكم', 'الركبة في خط القدم — لا تنهار للداخل', 'ثبات 3 ثوانٍ بعد الهبوط'],
    dose: { rtp: '3×6 هبوط لكل ساق' },
    prog: 'من ارتفاع قصير ← أعلى ← مع مد اليد للكرة ← مع إشعار اتجاه مفاجئ.',
    video: 'single leg landing mechanics rehab' },

  { id: 'multi-hop', ar: 'قفزات متعددة الاتجاهات', en: 'Multi-directional hops', pattern: 'jump', regions: ['knee','ankle','calf','groin','hip'], phases: ['rtp'], section: 'main', tag: 'plyo',
    desc: 'قفزات أمام/خلف وجانبية وقطرية على الساق المصابة — تحاكي فوضى المباراة الحقيقية.',
    cues: ['هبوط ناعم ثم انطلاقة سريعة', 'ابدأ بسلسلة قصيرة ثم كرر', 'قارن الإحساس بالساق السليمة'],
    dose: { rtp: '3×8 قفزات لكل اتجاه' },
    prog: 'اتجاه واحد ← مربعات ← مع كرة أو إشارة بصرية مفاجئة.',
    video: 'multi directional hopping rehab exercise' },

  { id: 'reactive-drill', ar: 'استجابة إشارة (عصبية-عضلية)', en: 'Reactive agility drills', pattern: 'agility', regions: ['knee','ankle','hamstring','hip'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'اللاعب يستجيب لإشارة أو حركة المدرب بتغيير اتجاه مفاجئ — يعيد بناء الثقة وردود الفعل بعد الإصابة.',
    cues: ['المدرب يشير للاتجاه في آخر لحظة', 'جولات قصيرة عالية الجودة', 'أوقف عند أي تردد أو ألم'],
    dose: { rtp: '8–10 استجابات، راحة 30 ثانية' },
    prog: 'إشارة يدوية ← كرة تُلقى ← ضد لاعب (1v1 خفيف).',
    video: 'reactive agility drills training' },

  { id: 'sport-drills', ar: 'مهارات المركز بتدرج شدة', en: 'Position-specific drills', pattern: 'agility', regions: ['knee','ankle','hamstring','quad','hip','groin','shoulder','calf'], phases: ['rtp'], section: 'main', tag: 'agility',
    desc: 'أعد مهامك الحقيقية في الملعب (تسديد، عرضية، مواجهة) بترتيب شدة تصاعدي — آخر اختبار قبل المشاركة الكاملة.',
    cues: ['ابدأ بشدة 50% لجولتين ثم ارفع', 'راقب الألم صباح اليوم التالي', 'حصتان كاملتان بدون أعراض = عودة'],
    dose: { rtp: '15–25 دقيقة حسب التدرج' },
    prog: 'فني بحركة خفيفة ← شدة كاملة بدون مواجهة ← مواجهة كاملة.',
    video: 'soccer position specific drills rehab' },

  { id: 'medball-throw', ar: 'رمي الكرة الطبية', en: 'Medicine ball throws', pattern: 'push', regions: ['shoulder','elbow','chest_abs'], phases: ['rtp'], section: 'main', tag: 'plyo',
    desc: 'رمي انفجاري بكرة طبية للجذع والكتف — يعيد قوة الدفع السريعة قبل العودة للمنافسة.',
    cues: ['كرة 1–3 كجم في البداية', 'رمي بذراع واحدة ثم بالجذع', 'لا تُقلق الكتف — الشد أمام الجسم أولًا'],
    dose: { rtp: '3×8 رميات لكل نمط' },
    prog: 'رمي أمامي ← جانبي بدوران جذع ← رمي فوق الرأس بتدرج.',
    video: 'medicine ball throw shoulder rehab' },

  { id: 'neck-resist', ar: 'مقاومة ديناميكية للرقبة', en: 'Dynamic neck resistance', pattern: 'band', regions: ['neck'], phases: ['rtp'], section: 'main', tag: 'strength',
    desc: 'حركة رأس فعالة ضد مطاط خفيف — يقوي عضلات الرقبة لمواجهات الرأس قبل العودة.',
    cues: ['مطاط خفيف — حركة كاملة بطيئة', 'بدون ألم أو دوخة إطلاقًا', 'أدِّها بعد الإيسومتريك يصبح سهلًا'],
    dose: { rtp: '3×10 لكل اتجاه' },
    prog: 'مطاط خفيف ← متوسط ← مع تمارين مواجهة خفيفة (كرة).',
    video: 'neck strengthening resistance band' },

  { id: 'wrist-load', ar: 'تحميل تدريجي للرسغ', en: 'Progressive wrist loading', pattern: 'band', regions: ['wrist','elbow'], phases: ['rtp'], section: 'main', tag: 'strength',
    desc: 'تحريك وتحميل الرسغ باتجاهات رياضية حقيقية (دفع، رفع، لف) لإعادة تمكين اليد للمنافسة.',
    cues: ['ابدأ بوزن الجسم على طاولة (دفع خفيف)', 'ثم دمبل خفيف بحركات وظيفية', 'ألم ≤ 2/10 مقبول ويتلاشى'],
    dose: { rtp: '3×10 لكل نمط' },
    prog: 'دفع على الحائط ← دفع أرضي ← مع كرة أو مضرب خفيف.',
    video: 'wrist loading rehabilitation exercises' },

  { id: 'core-rotation', ar: 'قوة دوران الجذع', en: 'Rotational core power', pattern: 'band', regions: ['chest_abs','lower_back','hip'], phases: ['rtp'], section: 'main', tag: 'strength',
    desc: 'دوران جذع قوي بمقاومة (رمي/سحب) — يحاكي التسديد والتسليلات ويحمي أسفل الظهر.',
    cues: ['القوة من الورك والأرض لا من الظهر', 'مطاط متوسط في البداية', 'الزفير مع الدوران'],
    dose: { rtp: '3×10 لكل جهة' },
    prog: 'مطاط ثابت ← رمي كرة طبية ← بحركة رياضية كاملة (تسديد).',
    video: 'rotational core power exercise' }
];

/* جرعات افتراضية حسب نوع التمرين لو لم تُحدد للمرحلة */
const DEFAULT_DOSE = {
  isometric: '5×10 ثوانٍ إمساك',
  rom: '2×10 بطيء',
  mobility: '2×10',
  strength: '3×10',
  eccentric: '3×8 خفض بطيء 3 ثوانٍ',
  balance: '3×30 ثانية',
  plyo: '3×8',
  agility: '4–6 جولات قصيرة'
};

/* ============ المحلل الذكي المحلي (يعمل بدون إنترنت) ============
   يفهم وصف المدرب بالعربي العامية ويستخرج: المناطق، نوع الإصابة، الشدة، الجهة، الألم، المحظورات، واقتراح المرحلة. */
const ANALYZER_REGIONS = [
  { re: /(قطني|أسفل الظهر|أسفل الضهر|الظهر|الضهر|ضهري|ضهر)/, k: 'lower_back' },
  { re: /(حوض|الورك|ورك|أرداف|مقعدة|ألوية)/, k: 'hip' },
  { re: /(خلفية الفخذ|خلف الفخذ|مأبضي|المأبضية|مأبضية|همسترينج|همسترنغ)/, k: 'hamstring' },
  { re: /(أمامية الفخذ|أمام الفخذ|رباعية|الرباعية|كواد)/, k: 'quad' },
  { re: /(ركبت?[ةه]|الركبة)/, k: 'knee' },
  { re: /(بطة الساق|البطة|سمانة|سمينة الساق|أكيليس|اخيليس|وصل الكعب)/, k: 'calf' },
  { re: /(ضام[ةه]|الضامّة|الضامة|داخل الفخذ|جنب الفخذ من جوه|أضلاع)/, k: 'groin' },
  { re: /(رقبت?[ةه]|الرقبة|فقرات الرقبة)/, k: 'neck' },
  { re: /(كتفي?|الكتف|الروتاتور)/, k: 'shoulder' },
  { re: /(مرفق|الكوع|كوع)/, k: 'elbow' },
  { re: /(رسغ|معصم|اليد)/, k: 'wrist' },
  { re: /(بطن|جذع|البطن|عضلات البطن)/, k: 'chest_abs' },
  { re: /(كاحل|القدم|كعب القدم|مشط|الكعب)/, k: 'ankle' }
];
const ANALYZER_TYPES = [
  { re: /(تمزق|قطع في العضلة|قطع)/, k: 'strain', grade: 2 },
  { re: /(شد عضل|شدت|شد في|مشدود|شدود|شد بسيط|شد[' ]?ة عضلي)/, k: 'strain', grade: 0 },
  { re: /(التواء|الفة|اتلوت|التوى|لفة)/, k: 'sprain' },
  { re: /(التهاب|وتر|تندنوباثي|tendin)/, k: 'tendon' },
  { re: /(كسر|إجهاد عظمي|ستريس فركتشر|stress fracture)/, k: 'bone' },
  { re: /(عملية|جراحة|منظار|بعد الجراحة|postop)/, k: 'postop' },
  { re: /(مزمن|إجهاد متكرر|من فترة طويلة|من شهور)/, k: 'overuse' }
];
const ANALYZER_GRADE = [
  { re: /(درجة أولى|درجة الاولى|بسيط|خفيف|grade ?1|grade ?i\b)/, g: 0 },
  { re: /(درجة ثانية|درجة تانية|متوسط|grade ?2|grade ?ii\b)/, g: 1 },
  { re: /(درجة ثالثة|درجة تالتة|تمزق كامل|شديد جدًا|grade ?3|grade ?iii\b)/, g: 2 }
];
const ANALYZER_SIDE = [
  { re: /(يمين|اليمين|right)/, s: 'right' },
  { re: /(شمال|الشمال|يسار|left)/, s: 'left' },
  { re: /(الاتنين|الجنبين|الجهتين|both)/, s: 'both' }
];
const ANALYZER_PAIN = [
  { re: /(ألم شديد|وجع شديد|في اوجعني جامد|ألم قوي)/, p: 7 },
  { re: /(ألم متوسط|وجع متوسط)/, p: 5 },
  { re: /(ألم بسيط|خفيف|وجع بسيط|تعب بسيط)/, p: 2 }
];
const ANALYZER_PHASE = [
  { re: /(امبارح|النهار|من يوم|أول يوم|ولّه يومين|حديث|توًّا|دلوقتي)/, ph: 'acute' },
  { re: /(من أسبوع|من ٢ أسبوع|من اسبوعين|من شهر|شهرين|قديم|مزمن|مدة طويلة)/, ph: 'strength' }
];

/* برومبت تحليل التقارير بالذكاء الاصطناعي (يُستخدم عند تفعيل المفتاح من الإعدادات) */
const AI_PROMPT = `أنت مساعد تأهيل رياضي. اقرأ التقرير الطبي المرفق (مع وصف المدرب إن وُجد) واستخرج البيانات.
أعد JSON فقط بدون أي نص إضافي، بهذا الشكل بالضبط:
{"regions": ["من المفاتيح"], "type": "مفتاح", "grade": 0 أو 1 أو 2 أو null, "side": "right|left|both|na", "pain": رقم 0-10 أو null, "summary": "ملخص التقرير بالعربية في سطر إلى سطرين", "restrictions": "المحظورات والتعليمات الطبية بالعربية كما وردت أو نص فارغ"}
مفاتيح regions المسموحة (اختَر كل المناطق المذكورة): neck, shoulder, elbow, wrist, chest_abs, groin, quad, knee, lower_back, hip, hamstring, calf, ankle
مفاتيح type المسموحة: strain (شد/تمزق عضلي) أو sprain (التواء أربطة) أو tendon (التهاب وتر) أو overuse (إجهاد مزمن) أو postop (بعد جراحة) أو bone (عظمي)
grade: 0 بسيط، 1 متوسط، 2 شديد/تمزق كامل، null إن لم يُذكر.
لا تخترع أي معلومة غير موجودة في التقرير — إن لم تُذكر اتركها null أو فارغة.`;

/* ============ الخط الزمني المتوقع للتعافي ============
   لكل نوع إصابة: مصفوفة لكل درجة → عدد أسابيع تقديري لكل مرحلة [١، ٢، ٣، ٤].
   تقديرات إرشادية عامة مبنية على بروتوكولات شائعة — تختلف حسب الحالة والفرد. */
const PHASE_COLORS = { acute: '#c05b4d', subacute: '#c98a2d', strength: '#2f9e8f', rtp: '#1c7c54' };
const TIMELINES = {
  strain:  { spans: [[0.5, 1, 2, 1.5], [1, 2.5, 4, 2.5], [4, 6, 10, 8]] },
  sprain:  { spans: [[0.5, 1, 1.5, 1], [1, 2, 3, 2], [3, 4, 6, 5]] },
  tendon:  { spans: [[0.5, 2, 6, 3], [1, 3, 8, 4]] },
  overuse: { spans: [[0.5, 1, 3, 2], [1, 2, 5, 3]] },
  postop:  { spans: [[4, 6, 10, 8], [6, 8, 12, 10], [8, 10, 16, 12]] },
  bone:    { spans: [[4, 4, 6, 4], [2, 4, 6, 4]] }
};

/* ============ اختبارات الجاهزية للرجوع للملاعب (Return-to-Play) ============
   لكل منطقة اختبارات معيارية + اختبارات عامة لكل الحالات. يُسجل تاريخ اجتياز كل اختبار. */
const RTP_GENERAL = [
  { id: 'g-sessions', name: 'حصتا تدريب كاملتان في يومين متتاليين', how: 'شارة تدريب عادية بلا ألم أثناءها ولا تورم بعدها' },
  { id: 'g-morning', name: 'ألم صفر صباح اليوم التالي للجلسة الشاقة', how: 'المؤشر الأصدق: لو اتصحى بدون ألم = التحميل متقبَّل' },
  { id: 'g-confidence', name: 'ثقة اللاعب 100% في الأداء', how: 'اسأله مباشرة: هتنفذ السبرنت/القفز بلا تردد؟ التردد نفسه عامل خطر' }
];
const RTP_TESTS = {
  knee: [
    { id: 'knee-rom', name: 'مدى حركة كامل بدون ألم', how: 'ثني وفرد كامل مساوي للركبة السليمة' },
    { id: 'knee-strength', name: 'قوة ≥ 90% من الساق السليمة', how: 'قرفصاء بساق واحدة: عدد التكرارات مقارنة بالأخرى' },
    { id: 'knee-hop', name: 'قفز على مكان بساق واحدة ×10', how: 'هبوط ثابت بدون ألم أو تورم بعدها (Hop test)' },
    { id: 'knee-cod', name: 'تغيير اتجاه 5-10-5 بسرعة كاملة', how: 'بدون تردد أو انهيار الركبة للداخل' }
  ],
  hamstring: [
    { id: 'ham-rom', name: 'مدى حركة كامل = الجانب الآخر', how: 'رفع ساق ممدودة: زاوية متساوية للجهتين' },
    { id: 'ham-nordic', name: 'نورديك 5 تكرارات بدون ألم', how: 'هبوط بطيء ومتحكم — أقوى اختبار لجاهزية المأبضية' },
    { id: 'ham-sprint', name: 'سبرنت 90% بدون ألم أو شد', how: '30–40 مترًا ثم راحة — راقب الإحساس مباشرة وبعده' },
    { id: 'ham-askling', name: 'اختبار إطالة نشطة (Askling)', how: 'رفع الساق المفرودة بأقصى سرعة — بلا خوف أو ألم' }
  ],
  ankle: [
    { id: 'ank-rom', name: 'مدى حركة كامل ومتساوي', how: 'ثني ظهري كامل بدون شد (قارن بالقدم الأخرى)' },
    { id: 'ank-balance', name: 'توازن بساق واحدة 30 ثانية', how: 'عيون مغلقة — ثم مع رمي كرة على حائط' },
    { id: 'ank-hop', name: 'قفزات جانبية ومربعات بدون تورم', how: 'سلسلة قفز 20 ثانية — راقب التورم بعد ساعة' },
    { id: 'ank-calf', name: 'رفع كعب بساق واحدة ×25', how: 'مدى كامل — مؤشر قوة البطة والوتر' }
  ],
  calf: [
    { id: 'calf-count', name: 'رفع كعب ×25 بساق واحدة', how: 'العدد مساوٍ أو قريب من الساق السليمة بدون ألم' },
    { id: 'calf-drop', name: 'خفض لامركزي على درجة بدون ألم', how: '3×15 خفض بطيء — ألم صفر أثناءه وبعده' },
    { id: 'calf-sprint', name: 'انطلاقة وسبرنت قصير', how: 'تسارع 20 مترًا — الوتر يتحمل أعلى قوة هنا' }
  ],
  quad: [
    { id: 'quad-strength', name: 'قوة ≥ 90% من الطرف الآخر', how: 'سكوات بساق واحدة أو رفع ساق — قارن التكرارات' },
    { id: 'quad-land', name: 'هبوط على ساق واحدة بدون ألم', how: 'من منصة 30–40 سم — الركبة في خط القدم' },
    { id: 'quad-kick', name: 'تسديد/انفجار رياضي كامل', how: 'المهمة الرياضية الأعلى تحميلًا للأمامية' }
  ],
  groin: [
    { id: 'groin-squeeze', name: 'عصر إيسومتري قوي بدون ألم', how: 'كرة بين الركبتين بجهد كامل 10 ثوانٍ' },
    { id: 'groin-copen', name: 'كوبنهاجن كامل 20 ثانية', how: 'بلانك جانبي والساق على مقعد — بدون ألم في الضامّة' },
    { id: 'groin-cod', name: 'تغييرات اتجاه جانبية سريعة', how: 'زوايا حادة وسحب كرة — المهمة الأعلى خطرًا للضامّة' }
  ],
  hip: [
    { id: 'hip-rom', name: 'دوران كامل ومتساوٍ للوركين', how: '90/90: الدوران الداخلي والخارجي متقاربان' },
    { id: 'hip-strength', name: 'ثبات حوض في جسر بساق واحدة', how: '10 تكرارات بدون هبوط جهة واحدة' },
    { id: 'hip-load', name: 'تحميل قفزي واتجاهي كامل', how: 'قفزات وتغيير اتجاه بدون ألم في مقدمة الورك' }
  ],
  lower_back: [
    { id: 'lb-rom', name: 'انحناء وفرد كامل بدون ألم', how: 'حركة الظهر الكاملة صباحًا — المقياس اليومي الأهم' },
    { id: 'lb-hinge', name: 'رفع تحميل بمفصلة ورك سليمة', how: 'روماني بحمل معقول بظهر مستقيم' },
    { id: 'lb-contact', name: 'حمل رياضي كامل (قفز/تدوير)', how: 'تسديدات ومواجهات خفيفة بدون ألم ليلي' }
  ],
  shoulder: [
    { id: 'sh-rom', name: 'مدى حركة كامل متساوٍ', how: 'رفع جانبي وفوق الرأس بزاوية متساوية للجهتين' },
    { id: 'sh-strength', name: 'قوة دوران خارجي ≥ 90%', how: 'مطاط أو مناوبة قوة — قارن بالكتف السليم' },
    { id: 'sh-throw', name: 'رمي كامل الشدة بدون ألم', how: 'تدرج رمي 50% ← 100% على عدة أيام' }
  ],
  elbow: [
    { id: 'elb-load', name: 'تحميل كامل بدون ألم', how: 'ضغط/رفع بوزن طبيعي بلا ألم في المرفق' },
    { id: 'elb-grip', name: 'قبضة قوية ومتساوية', how: 'عصر قوي 10 ثوانٍ — قارن باليد الأخرى' },
    { id: 'elb-skill', name: 'المهارة الرياضية الكاملة', how: 'الرماية/الضربة/التمرير بحركة كاملة بلا ألم' }
  ],
  wrist: [
    { id: 'wr-load', name: 'تحميل وزني كامل', how: 'دفع على الأرض بقبضات مفتوحة بدون ألم' },
    { id: 'wr-motion', name: 'كل اتجاهات الحركة ضد مقاومة', how: 'أربع اتجاهات بمطاط — قوة متساوية' },
    { id: 'wr-skill', name: 'استخدام يد كامل في المهارة', how: 'استقبال/تمرير/التصاق بحركة طبيعية' }
  ],
  neck: [
    { id: 'nk-iso', name: 'إيسومتريك قوي بأربعة اتجاهات', how: 'دفع كامل 10 ثوانٍ بكل اتجاه بدون ألم' },
    { id: 'nk-motion', name: 'حركة كاملة ضد مقاومة خفيفة', how: 'مطاط — مدى كامل بدون دوخة أو ألم' },
    { id: 'nk-contact', name: 'استعداد للمواجهات الهوائية', how: 'مهمة رياضية برأس/كتف بتدرج وحكم موافقة' }
  ],
  chest_abs: [
    { id: 'ca-strength', name: 'قوة جذع كاملة ضد دوران', how: 'بالوف بحمل كامل بدون ألم أو تعب مبكر' },
    { id: 'ca-power', name: 'قوة انفجارية (رمي/قفز)', how: 'كرة طبية بحركة كاملة — بدون ألم في الضرع' },
    { id: 'ca-load', name: 'حمل تدريبي كامل يومين متتاليين', how: 'معدة مستقرة تحت كل أنواع الحركة' }
  ]
};

/* ============ برامج الوقاية الجماعية (للفريق كله — بدون إصابة) ============ */
const PREVENTION_PROGRAMS = [
  { id: 'prev-warmup', ar: 'إحماء وقائي شامل قبل التدريب', en: 'Team prevention warm-up',
    desc: 'روتين إحماء كامل قبل كل حصة — يخفض إصابات الفريق عمومًا (نمط FIFA 11+). يصلح لكل الأعمار والمستويات.',
    duration: '15–20 دقيقة', when: 'قبل كل تدريب',
    items: [
      { exId: 'jog-prog', dose: '8 دقائق جري خفيف (مش الإصدار التدرجي)' },
      { exId: 'dyn-legs', dose: '2×10 لكل اتجاه' },
      { exId: 'band-walk', dose: '2×10 خطوة لكل جهة' },
      { exId: 'rot-9090', dose: '1×8 لكل جهة' },
      { exId: 'deadbug', dose: '2×8 لكل جانب' },
      { exId: 'side-plank', dose: '2×20 ثانية لكل جانب' },
      { exId: 'nordic', dose: '2×5 تكرارات (برنامج الوقاية الأساسي)' },
      { exId: 'copenhagen', dose: '2×10 ثوانٍ لكل جهة' },
      { exId: 'jump-land', dose: '2×6 قفزة مع هبوط صامت' },
      { exId: 'change-dir', dose: '3 جولات × 15 ثانية' }
    ] },
  { id: 'prev-hamstring', ar: 'وقاية خلفية الفخذ (المأبضية)', en: 'Hamstring injury prevention',
    desc: 'أشهر إصابة عضلية في الملاعب — برنامج النورديك واللامركزي يخفضها حتى 50%. لأصحاب التاريخ أو السرعات العالية.',
    duration: '10–15 دقيقة', when: 'مرتين أسبوعيًا بعد الإحماء',
    items: [
      { exId: 'nordic', dose: '3×5 تكرارات بمدى متزايد' },
      { exId: 'sl-rdl', dose: '3×8 لكل ساق' },
      { exId: 'ham-iso-bridge', dose: '3×10 ثوانٍ سحب' },
      { exId: 'sprint-prog', dose: '4–6 سبرنت × 30 متر تدرج سرعة' },
      { exId: 'decel', dose: '4 تكرارات تسارع وتوقف' }
    ] },
  { id: 'prev-knee', ar: 'وقاية الركبة وآلية القفز', en: 'Knee injury prevention',
    desc: 'يستهدف تمزق الأربطة (ACL) والآلام الأمامية: هبوط صحيح، قوة منفردة، وتوازن — لكل من يقفز ويغير اتجاهه.',
    duration: '15 دقيقة', when: '2–3 مرات أسبوعيًا',
    items: [
      { exId: 'jump-land', dose: '3×8 قفزة مع تصحيح آلية الهبوط' },
      { exId: 'sl-land', dose: '3×6 هبوط بساق واحدة' },
      { exId: 'sl-balance', dose: '3×30 ثانية لكل ساق' },
      { exId: 'step-up', dose: '3×8 لكل ساق' },
      { exId: 'band-walk', dose: '3×10 خطوة' },
      { exId: 'split-squat', dose: '3×8 لكل ساق' }
    ] },
  { id: 'prev-groin', ar: 'وقاية الضامّة (داخل الفخذ)', en: 'Groin injury prevention',
    desc: 'برنامج كوبنهاجن المعروف — يخفض إصابات الضامّة حتى 40%. ضروري لألعاب التغيير الاتجاهي والرمي بالجذع.',
    duration: '10 دقائق', when: 'مرتين أسبوعيًا',
    items: [
      { exId: 'copenhagen', dose: '3×10–20 ثانية لكل جهة (تدرج)' },
      { exId: 'add-squeeze', dose: '3×10 ثوانٍ عصر قوي' },
      { exId: 'side-lunge', dose: '3×8 لكل جهة' },
      { exId: 'band-walk', dose: '2×10 خطوة' }
    ] },
  { id: 'prev-ankle', ar: 'وقاية الكاحل والتواءات', en: 'Ankle sprain prevention',
    desc: 'التواء الكاحل أشهر إصابة مفصلية — التوازن والإحساس العميق يخفضان الانتكاس بشكل كبير. مهم جدًا لأصحاب التواء سابق.',
    duration: '8–10 دقائق', when: '3 مرات أسبوعيًا (وبعد أي التواء سابق: أطول)',
    items: [
      { exId: 'sl-balance', dose: '3×30 ثانية لكل قدم (عيون مفتوحة ثم مغلقة)' },
      { exId: 'balance-unstable', dose: '3×45 ثانية مع رمي كرة' },
      { exId: 'calf-raise', dose: '3×15' },
      { exId: 'toe-raise', dose: '2×12' },
      { exId: 'hop-prog', dose: '2×8 قفزات لكل نمط' }
    ] }
];
