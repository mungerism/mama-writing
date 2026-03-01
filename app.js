/**
 * 汉字临摹教学应用 - 葛素英
 * 使用 HanziWriter 库实现逐笔引导练习
 */

// ========================================
//  配置
// ========================================
const CHARACTERS = ['葛', '素', '英'];
const GRID_SIZE = 320;
const WRITER_PADDING = 15;

// ========================================
//  状态
// ========================================
let currentCharIndex = 0;
let writer = null;
let totalStrokesCount = 0;
let completedStrokes = 0;

// ========================================
//  DOM 元素
// ========================================
const writerContainer = document.getElementById('writer-container');
const nextBtn = document.getElementById('next-btn');
const hintText = document.getElementById('hint-text');
const currentStrokeEl = document.getElementById('current-stroke');
const totalStrokesEl = document.getElementById('total-strokes');
const progressFill = document.getElementById('progress-fill');
const startPage = document.getElementById('start-page');
const practicePage = document.getElementById('practice-page');
const completePage = document.getElementById('complete-page');
const completeCharsContainer = document.getElementById('complete-characters');

// ========================================
//  开始应用（用户点击后触发，解决微信浏览器语音限制）
// ========================================
function startApp() {
    startPage.classList.remove('active');
    practicePage.classList.add('active');
    initCharacter(0);
}

// ========================================
//  语音合成
// ========================================
function speak(text, onEnd) {
    if (!('speechSynthesis' in window)) {
        if (onEnd) setTimeout(onEnd, 500);
        return;
    }

    // 取消之前的语音
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 0.85;
    utterance.pitch = 1.1;
    utterance.volume = 1;

    // 尝试获取中文语音
    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utterance.voice = zhVoice;

    if (onEnd) {
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
    }

    // 小延时确保语音引擎就绪
    setTimeout(() => {
        window.speechSynthesis.speak(utterance);
    }, 200);
}

// 确保语音列表已加载
if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
    };
}

// ========================================
//  进度更新
// ========================================
function updateProgress() {
    const dots = document.querySelectorAll('.dot');
    dots.forEach((dot, index) => {
        dot.classList.remove('active', 'done');
        if (index < currentCharIndex) {
            dot.classList.add('done');
        } else if (index === currentCharIndex) {
            dot.classList.add('active');
        }
    });

    // 进度条: 基于已完成的字
    const percent = (currentCharIndex / CHARACTERS.length) * 100;
    progressFill.style.width = percent + '%';
}

function updateStrokeCounter(current, total) {
    currentStrokeEl.textContent = current;
    totalStrokesEl.textContent = total;
}

// ========================================
//  核心: 初始化字练习
// ========================================
function initCharacter(charIndex) {
    currentCharIndex = charIndex;
    completedStrokes = 0;
    quizStarted = false; // 重置，允许新字启动 quiz
    const char = CHARACTERS[charIndex];

    // 清除旧的 writer
    writerContainer.innerHTML = '';
    nextBtn.classList.add('hidden');

    // 更新进度
    updateProgress();

    // 更新提示
    hintText.textContent = '准备中...';
    hintText.style.animation = 'none';
    hintText.offsetHeight; // 触发重排
    hintText.style.animation = 'fadeInUp 0.5s ease';

    // 创建 HanziWriter 实例
    writer = HanziWriter.create('writer-container', char, {
        width: GRID_SIZE,
        height: GRID_SIZE,
        padding: WRITER_PADDING,
        showCharacter: false,      // 不立即显示完整字
        showOutline: true,         // 显示灰色轮廓
        strokeColor: '#333',       // 正确笔画颜色（深色）
        outlineColor: '#ddd',      // 轮廓颜色（灰色）
        highlightColor: '#e74c3c', // 提示高亮颜色（红色）
        drawingColor: '#555',      // 用户绘制时的颜色
        strokeAnimationSpeed: 0.02,
        delayBetweenStrokes: 300,
        highlightOnComplete: true,
        charDataLoader: function (char, onLoad) {
            // 使用默认 CDN 加载
            fetch('https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0/' + char + '.json')
                .then(function (res) { return res.json(); })
                .then(function (data) {
                    totalStrokesCount = data.strokes.length;
                    updateStrokeCounter(0, totalStrokesCount);
                    onLoad(data);
                });
        }
    });

    hintText.textContent = '跟着红色笔画写一写吧！';

    // 语音播报完成后开始红色笔画演示
    speak('跟着我写，' + char, function () {
        startQuiz();
    });
    // 保底：如果语音回调未触发，3秒后也启动
    setTimeout(function () {
        startQuiz();
    }, 3000);
}

// ========================================
//  红色演示：播放两遍高亮
// ========================================
function highlightStrokeTwice(strokeNum, callback) {
    writer.highlightStroke(strokeNum, {
        onComplete: function () {
            // 第二遍
            writer.highlightStroke(strokeNum, {
                onComplete: function () {
                    if (callback) callback();
                }
            });
        }
    });
}

// ========================================
//  开始测验模式
// ========================================
function startQuiz() {
    if (!writer) return;

    // 先用红色动画演示第一笔（两遍），再启动 quiz
    hintText.textContent = '看好红色笔画，跟着写～';
    highlightStrokeTwice(0, function () {
        // 两遍演示完毕，开始 quiz
        writer.quiz({
            showHintAfterMisses: 1,     // 错1次立即显示红色提示
            highlightOnComplete: true,
            leniency: 1.2,
            markStrokeCorrectAfterMisses: 5,

            onCorrectStroke: function (data) {
                completedStrokes = data.strokeNum + 1;
                updateStrokeCounter(completedStrokes, data.strokesRemaining + completedStrokes);

                // 还有下一笔 → 红色演示两遍
                if (data.strokesRemaining > 0) {
                    hintText.textContent = '很好！看下一笔 ✓';
                    hintText.style.animation = 'none';
                    hintText.offsetHeight;
                    hintText.style.animation = 'fadeInUp 0.3s ease';
                    setTimeout(function () {
                        highlightStrokeTwice(data.strokeNum + 1);
                    }, 300);
                }
            },

            onMistake: function (data) {
                hintText.textContent = '没关系，再试试这一笔 ~';
                hintText.style.animation = 'none';
                hintText.offsetHeight;
                hintText.style.animation = 'fadeInUp 0.3s ease';
            },

            onComplete: function (data) {
                completedStrokes = totalStrokesCount;
                updateStrokeCounter(totalStrokesCount, totalStrokesCount);

                const char = CHARACTERS[currentCharIndex];
                hintText.textContent = '太棒了！"' + char + '"写好了！';

                // 等语音和礼花都完成后再跳转
                var speechDone = false;
                var confettiDone = false;
                var isLast = currentCharIndex >= CHARACTERS.length - 1;

                function tryProceed() {
                    if (!speechDone || !confettiDone) return;
                    if (isLast) {
                        setTimeout(showCompletePage, 300);
                    } else {
                        currentCharIndex++;
                        initCharacter(currentCharIndex);
                    }
                }

                speak(char + '写得真好！', function () {
                    speechDone = true;
                    tryProceed();
                });
                // 保底：语音最多等3秒
                setTimeout(function () {
                    speechDone = true;
                    tryProceed();
                }, 3000);

                launchMiniConfetti(function () {
                    confettiDone = true;
                    tryProceed();
                });
            }
        });
    });
}

// ========================================
//  下一个字
// ========================================
function nextCharacter() {
    nextBtn.classList.add('hidden');

    if (currentCharIndex < CHARACTERS.length - 1) {
        currentCharIndex++;
        initCharacter(currentCharIndex);
    }
}

// ========================================
//  完成页面
// ========================================
function showCompletePage() {
    // 构建完成页面的字展示
    completeCharsContainer.innerHTML = '';
    CHARACTERS.forEach(function (char) {
        const charDiv = document.createElement('div');
        charDiv.className = 'complete-char';

        // 田字格线
        const hLine = document.createElement('div');
        hLine.className = 'mini-grid-h';
        const vLine = document.createElement('div');
        vLine.className = 'mini-grid-v';
        charDiv.appendChild(hLine);
        charDiv.appendChild(vLine);

        // 给每个字一个唯一 ID
        const writerId = 'complete-' + char;
        const writerDiv = document.createElement('div');
        writerDiv.id = writerId;
        writerDiv.style.position = 'absolute';
        writerDiv.style.inset = '0';
        charDiv.appendChild(writerDiv);

        completeCharsContainer.appendChild(charDiv);

        // 创建 mini writer 显示字
        HanziWriter.create(writerId, char, {
            width: 120,
            height: 120,
            padding: 8,
            strokeColor: '#333',
            strokeAnimationSpeed: 2,
            delayBetweenStrokes: 80,
            showCharacter: false,
            showOutline: false
        }).animateCharacter();
    });

    // 切换页面
    practicePage.classList.remove('active');
    completePage.classList.add('active');

    // 彩花效果
    launchConfetti();

    // 语音祝贺
    setTimeout(function () {
        speak('恭喜你，你的名字写好了！');
    }, 600);
}

// ========================================
//  重新开始
// ========================================
function restartPractice() {
    completePage.classList.remove('active');
    practicePage.classList.add('active');
    currentCharIndex = 0;
    initCharacter(0);
}

// ========================================
//  小礼花特效（快速、轻量）
// ========================================
function launchMiniConfetti(onDone) {
    const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6'];
    const count = 20;
    const totalDuration = 1200; // 整个特效持续约 1.2 秒

    for (let i = 0; i < count; i++) {
        setTimeout(function () {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = (Math.random() * 5 + 3) + 'px';
            confetti.style.height = (Math.random() * 5 + 3) + 'px';
            confetti.style.animationDuration = (Math.random() * 0.8 + 0.8) + 's';
            confetti.style.animationDelay = '0s';
            document.body.appendChild(confetti);

            setTimeout(function () {
                confetti.remove();
            }, 2000);
        }, i * 30);
    }

    // 礼花播完后执行回调
    if (onDone) {
        setTimeout(onDone, totalDuration);
    }
}

// ========================================
//  大礼花特效（完成页用）
// ========================================
function launchConfetti() {
    const colors = ['#e74c3c', '#f39c12', '#2ecc71', '#3498db', '#9b59b6', '#e91e63', '#ff5722'];
    const count = 60;

    for (let i = 0; i < count; i++) {
        setTimeout(function () {
            const confetti = document.createElement('div');
            confetti.className = 'confetti';
            confetti.style.left = Math.random() * 100 + 'vw';
            confetti.style.top = '-10px';
            confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
            confetti.style.width = (Math.random() * 8 + 5) + 'px';
            confetti.style.height = (Math.random() * 8 + 5) + 'px';
            confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
            confetti.style.animationDelay = '0s';
            document.body.appendChild(confetti);

            setTimeout(function () {
                confetti.remove();
            }, 4500);
        }, i * 50);
    }
}

// ========================================
//  防止 startQuiz 重复调用
// ========================================
var quizStarted = false;
var _origStartQuiz = startQuiz;
startQuiz = function () {
    if (quizStarted) return;
    quizStarted = true;
    _origStartQuiz();
};
