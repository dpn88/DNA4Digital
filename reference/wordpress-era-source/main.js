// DNA4Digital - Main JavaScript File

// Global variables
let currentQuestion = 0;
let assessmentScore = 0;
let answers = [];

// Assessment Questions
const assessmentQuestions = [
    {
        id: 1,
        question: "How would you describe your organization's current data infrastructure?",
        options: [
            { text: "We have limited data collection and storage capabilities", value: 1 },
            { text: "We collect data but lack organized storage systems", value: 2 },
            { text: "We have structured databases but limited integration", value: 3 },
            { text: "We have advanced data infrastructure with real-time processing", value: 4 }
        ]
    },
    {
        id: 2,
        question: "What is your team's current level of AI/ML expertise?",
        options: [
            { text: "No prior experience with AI/ML technologies", value: 1 },
            { text: "Some team members have basic understanding", value: 2 },
            { text: "We have dedicated data scientists or ML engineers", value: 3 },
            { text: "We have an experienced AI/ML team", value: 4 }
        ]
    },
    {
        id: 3,
        question: "How are decisions currently made in your organization?",
        options: [
            { text: "Primarily based on intuition and experience", value: 1 },
            { text: "Mix of intuition and basic reporting", value: 2 },
            { text: "Data-driven with regular analytics", value: 3 },
            { text: "Highly data-driven with predictive insights", value: 4 }
        ]
    },
    {
        id: 4,
        question: "What is your organization's approach to technology adoption?",
        options: [
            { text: "Cautious and reactive to new technologies", value: 1 },
            { text: "Selective adoption after thorough evaluation", value: 2 },
            { text: "Proactive adoption of proven technologies", value: 3 },
            { text: "Innovation-focused with early adoption", value: 4 }
        ]
    },
    {
        id: 5,
        question: "How would you rate your current business process automation?",
        options: [
            { text: "Mostly manual processes with minimal automation", value: 1 },
            { text: "Some automated workflows but many manual steps", value: 2 },
            { text: "Well-automated core processes with room for improvement", value: 3 },
            { text: "Highly automated with intelligent systems", value: 4 }
        ]
    },
    {
        id: 6,
        question: "What is your budget allocation for digital transformation initiatives?",
        options: [
            { text: "Limited budget allocated for technology initiatives", value: 1 },
            { text: "Moderate budget with careful ROI consideration", value: 2 },
            { text: "Substantial budget for strategic technology investments", value: 3 },
            { text: "Significant budget with innovation-focused spending", value: 4 }
        ]
    },
    {
        id: 7,
        question: "How does your organization handle change management?",
        options: [
            { text: "Change is often resisted and difficult to implement", value: 1 },
            { text: "Change is managed reactively when necessary", value: 2 },
            { text: "Structured change management processes are in place", value: 3 },
            { text: "Agile and adaptive to continuous change", value: 4 }
        ]
    },
    {
        id: 8,
        question: "What are your main business goals for the next 2-3 years?",
        options: [
            { text: "Maintain current operations and market position", value: 1 },
            { text: "Gradual growth with improved efficiency", value: 2 },
            { text: "Significant growth and market expansion", value: 3 },
            { text: "Market leadership through innovation and disruption", value: 4 }
        ]
    }
];

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
});

function initializeApp() {
    // Initialize typewriter effect
    initTypewriter();
    
    // Initialize particle background
    initParticles();
    
    // Initialize scroll animations
    initScrollAnimations();
    
    // Initialize counter animations
    initCounterAnimations();
    
    // Initialize assessment tool
    initAssessmentTool();
    
    // Initialize smooth scrolling
    initSmoothScrolling();
    
    // Initialize mobile menu
    initMobileMenu();
}

// Typewriter Effect
function initTypewriter() {
  const el = document.getElementById('typed-text');
  if (!el || typeof Typed === 'undefined') return;

  new Typed('#typed-text', {
    strings: [
      'GTM Design',
      'Process Architecture',
      'Strategic Audits',
      'Expert Training',
      'AI Enablement'
    ],
    typeSpeed: 80,
    backSpeed: 50,
    backDelay: 2000,
    loop: true,
    showCursor: true,
    cursorChar: '|',
    contentType: 'html'
  });
}




// Particle Background (richer / denser)
function initParticles(options = {}) {
  const host = document.getElementById('particles-canvas');
  if (!host || typeof p5 === 'undefined') return;

  // ---- Tweakables (lower density number = MORE particles) ----
  const cfg = Object.assign({
    density: window.innerWidth < 900 ? 18000 : 14000, // px per particle (12000 = dense; 18000 = lighter)
    linkDist: 150,          // max distance to draw lines
    maxNeighbors: 4,        // how many nearest neighbors to link per particle
    speed: 0.35,            // base movement speed
    sizeMin: 1.3,           // min particle size
    sizeMax: 3.1,           // max particle size
    noiseScale: 0.0012,     // lower = wider curls, higher = tighter motion
    glow: true,             // soft glow around nodes
    triangles: true,        // fill subtle triangles between close neighbors
    triangleAlpha: 10,      // 0–255 fill alpha for triangles
    lineAlpha: 90,          // 0–255 max line alpha (fades with distance)
    nodeAlpha: 120,         // 0–255 node alpha
  }, options);

  const TEAL = { r: 45, g: 212, b: 191 }; // DNA4Digital brand

  new p5((p) => {
    let particles = [];

    function targetCount() {
      return Math.max(20, Math.round((p.width * p.height) / cfg.density));
    }

    class Particle {
      constructor(x, y) {
        this.x = x;
        this.y = y;
        this.r = p.random(cfg.sizeMin, cfg.sizeMax);
        this.seed = p.random(1000);
      }

      update(t) {
        const ang = p.noise(this.x * cfg.noiseScale, this.y * cfg.noiseScale, t * 0.00025 + this.seed) * p.TWO_PI * 2;
        this.x += Math.cos(ang) * cfg.speed;
        this.y += Math.sin(ang) * cfg.speed;

        // wrap with a small margin to avoid popping
        const m = 10;
        if (this.x < -m) this.x = p.width + m;
        if (this.x > p.width + m) this.x = -m;
        if (this.y < -m) this.y = p.height + m;
        if (this.y > p.height + m) this.y = -m;
      }

      drawNode() {
        if (cfg.glow) {
          p.drawingContext.shadowBlur = 12;
          p.drawingContext.shadowColor = `rgba(${TEAL.r},${TEAL.g},${TEAL.b},0.6)`;
        }
        p.noStroke();
        p.fill(TEAL.r, TEAL.g, TEAL.b, cfg.nodeAlpha);

        // gentle twinkle
        const pulse = 0.5 + 0.5 * Math.sin((p.frameCount + this.seed * 1000) * 0.03);
        p.circle(this.x, this.y, this.r * (0.85 + 0.3 * pulse));

        if (cfg.glow) p.drawingContext.shadowBlur = 0;
      }
    }

    function connectAndDecorate() {
      // pairwise neighborhood scan (good enough up to a few hundred points)
      for (let i = 0; i < particles.length; i++) {
        const a = particles[i];
        const neighbors = [];

        for (let j = i + 1; j < particles.length; j++) {
          const b = particles[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.hypot(dx, dy);
          if (d < cfg.linkDist) neighbors.push({ b, d });
        }

        neighbors.sort((m, n) => m.d - n.d);
        const close = neighbors.slice(0, cfg.maxNeighbors);

        // lines
        for (const { b, d } of close) {
          const alpha = p.map(d, 0, cfg.linkDist, cfg.lineAlpha, 0, true);
          p.stroke(TEAL.r, TEAL.g, TEAL.b, alpha);
          p.strokeWeight(0.7);
          p.line(a.x, a.y, b.x, b.y);
        }

        // subtle filled triangles
        if (cfg.triangles && close.length >= 2) {
          const b = close[0].b;
          const c = close[1].b;
          const ab = Math.hypot(a.x - b.x, a.y - b.y);
          const ac = Math.hypot(a.x - c.x, a.y - c.y);
          const bc = Math.hypot(b.x - c.x, b.y - c.y);
          if (ab < cfg.linkDist && ac < cfg.linkDist && bc < cfg.linkDist) {
            p.noStroke();
            p.fill(TEAL.r, TEAL.g, TEAL.b, cfg.triangleAlpha);
            p.triangle(a.x, a.y, b.x, b.y, c.x, c.y);
          }
        }
      }
    }

    p.setup = function () {
      const c = p.createCanvas(window.innerWidth, window.innerHeight);
      c.parent(host);
      p.noiseSeed(Math.floor(Math.random() * 1e6));

      const n = targetCount();
      for (let i = 0; i < n; i++) {
        particles.push(new Particle(p.random(p.width), p.random(p.height)));
      }
    };

    p.draw = function () {
      p.clear(); // keep site background gradient visible

      const t = p.millis();
      for (const pt of particles) pt.update(t);

      // draw connections first so nodes glow on top
      connectAndDecorate();
      for (const pt of particles) pt.drawNode();
    };

    p.windowResized = function () {
      p.resizeCanvas(window.innerWidth, window.innerHeight);

      // re-balance particle count to maintain density
      const desired = targetCount();
      if (desired > particles.length) {
        for (let i = particles.length; i < desired; i++) {
          particles.push(new Particle(p.random(p.width), p.random(p.height)));
        }
      } else if (desired < particles.length) {
        particles.length = desired;
      }
    };
  });
}




// Scroll Animations
function initScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    // Observe all fade-in elements
    document.querySelectorAll('.fade-in').forEach(el => {
        observer.observe(el);
    });
}

// Counter Animations
function initCounterAnimations() {
    const counters = document.querySelectorAll('.stats-counter');
    
    const observerOptions = {
        threshold: 0.5
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                animateCounter(entry.target);
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);
    
    counters.forEach(counter => {
        observer.observe(counter);
    });
}

function animateCounter(element) {
    const target = parseInt(element.getAttribute('data-target'));
    const duration = 2000;
    const start = performance.now();
    
    function updateCounter(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const current = Math.floor(easeOut * target);
        
        element.textContent = current;
        
        if (progress < 1) {
            requestAnimationFrame(updateCounter);
        }
    }
    
    requestAnimationFrame(updateCounter);
}

// Assessment Tool
function initAssessmentTool() {
    displayQuestion(0);
}

function displayQuestion(index) {
    const container = document.getElementById('question-container');
    const question = assessmentQuestions[index];
    
    container.innerHTML = `
        <div class="question-slide">
            <h3 class="text-2xl font-bold text-gray-900 mb-8">
                ${question.question}
            </h3>
            <div class="space-y-4">
                ${question.options.map((option, i) => `
                    <button class="option-btn w-full text-left p-4 rounded-lg border-2 border-gray-200 hover:border-teal-500 hover:bg-teal-50 transition-all duration-200" 
                            onclick="selectOption(${option.value}, ${i})">
                        <div class="flex items-center">
                            <div class="w-4 h-4 border-2 border-gray-300 rounded-full mr-4 option-radio" id="radio-${i}"></div>
                            <span class="text-gray-700">${option.text}</span>
                        </div>
                    </button>
                `).join('')}
            </div>
            <div class="flex justify-between mt-8">
                <button class="px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors ${index === 0 ? 'invisible' : ''}" 
                        onclick="previousQuestion()" id="prev-btn">
                    ← Previous
                </button>
                <button class="btn-primary px-6 py-3 rounded-lg font-medium opacity-50 cursor-not-allowed" 
                        onclick="nextQuestion()" id="next-btn" disabled>
                    ${index === assessmentQuestions.length - 1 ? 'Get Results' : 'Next →'}
                </button>
            </div>
        </div>
    `;
    
    updateProgress();
}

function selectOption(value, index) {
    // Remove previous selections
    document.querySelectorAll('.option-btn').forEach(btn => {
        btn.classList.remove('border-teal-500', 'bg-teal-50');
    });
    document.querySelectorAll('.option-radio').forEach(radio => {
        radio.style.backgroundColor = '';
        radio.style.borderColor = '#d1d5db';
    });
    
    // Add selection to clicked option
    const selectedBtn = document.querySelectorAll('.option-btn')[index];
    const selectedRadio = document.getElementById(`radio-${index}`);
    
    selectedBtn.classList.add('border-teal-500', 'bg-teal-50');
    selectedRadio.style.backgroundColor = '#2dd4bf';
    selectedRadio.style.borderColor = '#2dd4bf';
    
    // Store answer
    answers[currentQuestion] = value;
    
    // Enable next button
    const nextBtn = document.getElementById('next-btn');
    nextBtn.disabled = false;
    nextBtn.classList.remove('opacity-50', 'cursor-not-allowed');
}

function nextQuestion() {
    if (currentQuestion < assessmentQuestions.length - 1) {
        currentQuestion++;
        displayQuestion(currentQuestion);
    } else {
        calculateAndShowResults();
    }
}

function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        displayQuestion(currentQuestion);
    }
}

function updateProgress() {
    const progress = ((currentQuestion + 1) / assessmentQuestions.length) * 100;
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    
    if (progressBar) {
        progressBar.style.width = `${progress}%`;
    }
    if (progressText) {
        progressText.textContent = `${currentQuestion + 1} of ${assessmentQuestions.length} questions`;
    }
}

function calculateAndShowResults() {
    // Calculate total score
    const totalScore = answers.reduce((sum, answer) => sum + answer, 0);
    const maxScore = assessmentQuestions.length * 4;
    const percentageScore = Math.round((totalScore / maxScore) * 100);
    
    assessmentScore = percentageScore;
    
    // Hide question container and show results
    document.getElementById('question-container').style.display = 'none';
    document.getElementById('results-container').classList.remove('hidden');
    
    // Animate score display
    animateScoreDisplay(percentageScore);
    
    // Generate recommendations
    generateRecommendations(percentageScore);
}

function animateScoreDisplay(score) {
    const scoreDisplay = document.getElementById('score-display');
    const scoreTitle = document.getElementById('score-title');
    const scoreDescription = document.getElementById('score-description');
    
    // Animate score counting
    let currentScore = 0;
    const duration = 2000;
    const start = performance.now();
    
    function updateScore(currentTime) {
        const elapsed = currentTime - start;
        const progress = Math.min(elapsed / duration, 1);
        
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentScore = Math.floor(easeOut * score);
        
        scoreDisplay.textContent = currentScore;
        
        if (progress < 1) {
            requestAnimationFrame(updateScore);
        }
    }
    
    requestAnimationFrame(updateScore);
    
    // Set title and description based on score
    if (score < 40) {
        scoreTitle.textContent = 'AI Beginner';
        scoreDescription.textContent = 'A great starting point for your AI journey';
    } else if (score < 70) {
        scoreTitle.textContent = 'AI Ready';
        scoreDescription.textContent = 'You have solid foundations for AI implementation';
    } else {
        scoreTitle.textContent = 'AI Advanced';
        scoreDescription.textContent = "You're well positioned for AI-driven transformation";
    }
}

function generateRecommendations(score) {
    const recommendations = document.getElementById('recommendations');
    let recs = [];
    
    if (score < 40) {
        recs = [
            'Start with AI education and awareness-building for leadership',
            'Assess your current data infrastructure and create an improvement plan',
            'Launch pilot programs for AI adoption in low-risk areas',
            'Build basic data collection and management capabilities'
        ];
    } else if (score < 70) {
        recs = [
            'Run workshops to develop your AI strategy',
            'Upgrade your data infrastructure for AI readiness',
            'Launch targeted AI pilot programs',
            'Invest in team training and skills development'
        ];
    } else {
        recs = [
            'Scale successful AI pilots across the organization',
            'Implement advanced AI governance frameworks',
            'Develop custom AI solutions for competitive advantage',
            'Establish AI innovation labs and R&D programs'
        ];
    }
    
    recommendations.innerHTML = recs.map(rec => `
        <div class="flex items-start">
            <div class="w-2 h-2 bg-teal-600 rounded-full mt-2 mr-3 flex-shrink-0"></div>
            <p class="text-gray-700">${rec}</p>
        </div>
    `).join('');
}

function restartAssessment() {
    currentQuestion = 0;
    assessmentScore = 0;
    answers = [];
    
    document.getElementById('results-container').classList.add('hidden');
    document.getElementById('question-container').style.display = 'block';
    
    displayQuestion(0);
}

// Utility Functions
function scrollToAssessment() {
    document.getElementById('assessment').scrollIntoView({
        behavior: 'smooth'
    });
}

function showContactForm() {
    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    modal.innerHTML = `
        <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4">
            <div class="text-center mb-6">
                <h3 class="text-2xl font-bold text-gray-900 mb-2">Get Your Custom AI Strategy</h3>
                <p class="text-gray-600">Schedule a free consultation with our AI experts</p>
            </div>
            
            <form class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
                    <input type="text" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
                    <input type="email" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Company Name</label>
                    <input type="text" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500" required>
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
                    <input type="tel" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500">
                </div>
                
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-2">AI Readiness Score</label>
                    <input type="text" value="${assessmentScore}" class="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50" readonly>
                </div>
                
                <div class="flex gap-4 pt-4">
                    <button type="submit" class="btn-primary flex-1 py-3 rounded-lg font-medium">
                        Schedule Consultation
                    </button>
                    <button type="button" class="btn-secondary flex-1 py-3 rounded-lg font-medium" onclick="closeModal()">
                        Cancel
                    </button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Handle form submission
    modal.querySelector('form').addEventListener('submit', function(e) {
        e.preventDefault();
        // Simulate form submission
        alert('Thank you! We\'ll contact you within 24 hours to schedule your consultation.');
        closeModal();
    });
    
    // Close on overlay click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeModal();
        }
    });
}

function closeModal() {
    const modal = document.querySelector('.fixed.inset-0');
    if (modal) {
        modal.remove();
    }
}

// Smooth Scrolling
function initSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

// Mobile Menu
function initMobileMenu() {
    const mobileMenuButton = document.querySelector('.md\\:hidden button');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', function() {
            // Toggle mobile menu (simplified implementation)
            alert('Mobile menu functionality would be implemented here');
        });
    }
}

// Utility function for button clicks
function handleButtonClick(action) {
    switch(action) {
        case 'assessment':
            scrollToAssessment();
            break;
        case 'contact':
            showContactForm();
            break;
        default:
            console.log('Button action:', action);
    }
}

// Export functions for global access
window.scrollToAssessment = scrollToAssessment;
window.showContactForm = showContactForm;
window.restartAssessment = restartAssessment;
window.selectOption = selectOption;
window.nextQuestion = nextQuestion;
window.previousQuestion = previousQuestion;
window.handleButtonClick = handleButtonClick;