document.addEventListener('DOMContentLoaded', () => {
    // Initialize Lucide Icons
    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }

    // 1. Header Scroll Effect
    const header = document.getElementById('header');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 20) {
            header.classList.add('scrolled');
        } else {
            header.classList.remove('scrolled');
        }
    });

    // 2. Mobile Menu Toggle
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navMenu = document.querySelector('.nav-menu');
    const navActions = document.querySelector('.nav-actions');

    mobileMenuBtn.addEventListener('click', () => {
        const isExpanded = mobileMenuBtn.getAttribute('aria-expanded') === 'true';
        mobileMenuBtn.setAttribute('aria-expanded', !isExpanded);
        
        // Simple toggle for mobile view (if CSS media query supports displaying them)
        navMenu.style.display = navMenu.style.display === 'flex' ? 'none' : 'flex';
        navActions.style.display = navActions.style.display === 'flex' ? 'none' : 'flex';
        
        const menuIcon = mobileMenuBtn.querySelector('i');
        if (menuIcon) {
            if (isExpanded) {
                menuIcon.setAttribute('data-lucide', 'menu');
            } else {
                menuIcon.setAttribute('data-lucide', 'x');
            }
            lucide.createIcons();
        }
    });

    // Close menu when clicking nav links
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                navMenu.style.display = 'none';
                navActions.style.display = 'none';
                mobileMenuBtn.setAttribute('aria-expanded', 'false');
                const menuIcon = mobileMenuBtn.querySelector('i');
                if (menuIcon) {
                    menuIcon.setAttribute('data-lucide', 'menu');
                    lucide.createIcons();
                }
            }
        });
    });

    // 3. Hero Mockup Tabs Switcher
    const tabBtns = document.querySelectorAll('.mockup-tab-btn');
    const mockupImages = document.querySelectorAll('.mockup-image');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active from all buttons
            tabBtns.forEach(b => b.classList.remove('active'));
            // Add active to current button
            btn.classList.add('active');

            // Switch active image
            const targetId = btn.getAttribute('data-target');
            mockupImages.forEach((img, index) => {
                if (index + 1 === parseInt(targetId)) {
                    img.classList.add('active');
                } else {
                    img.classList.remove('active');
                }
            });
        });
    });

    // Mockup Refresh Action Animation
    const refreshBtn = document.getElementById('mockup-refresh');
    refreshBtn.addEventListener('click', () => {
        const activeImg = document.querySelector('.mockup-image.active');
        if (activeImg) {
            activeImg.style.opacity = '0';
            refreshBtn.classList.add('rotating');
            setTimeout(() => {
                activeImg.style.opacity = '1';
                refreshBtn.classList.remove('rotating');
            }, 350);
        }
    });

    // Add rotating transition style dynamically
    const style = document.createElement('style');
    style.innerHTML = `
        .mockup-action-btn i {
            transition: transform 0.4s ease;
        }
        .rotating i {
            transform: rotate(360deg);
        }
    `;
    document.head.appendChild(style);

    // 4. Feature Cards Hover Mouse-Glow Effect
    const featureCards = document.querySelectorAll('.feature-card');
    featureCards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });

    // 5. Before/After Comparison Slider
    const compToggleBtns = document.querySelectorAll('.comparison-toggle-btn');
    const screenBefore = document.getElementById('screen-before');
    const screenAfter = document.getElementById('screen-after');
    const compHeading = document.getElementById('comparison-heading');
    const compText = document.getElementById('comparison-text');

    const comparisonDetails = {
        after: {
            heading: "Clean visual feedback",
            text: "A beautiful visual grid where today is highlighted, room locations are tagged, and exam status is visually colored for clear visibility."
        },
        before: {
            heading: "Plain table layout",
            text: "The standard Polimi layout is a dense, gray-on-white text table that makes it difficult to plan your exams, verify schedules, or spot overlaps."
        }
    };

    compToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            compToggleBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const view = btn.getAttribute('data-show');
            if (view === 'after') {
                screenAfter.classList.add('active');
                screenBefore.classList.remove('active');
                compHeading.textContent = comparisonDetails.after.heading;
                compText.textContent = comparisonDetails.after.text;
            } else {
                screenBefore.classList.add('active');
                screenAfter.classList.remove('active');
                compHeading.textContent = comparisonDetails.before.heading;
                compText.textContent = comparisonDetails.before.text;
            }
        });
    });

    // 6. Install Guide Browser Tabs
    const installTabBtns = document.querySelectorAll('.install-tab-btn');
    const installContentItems = document.querySelectorAll('.install-content-item');

    installTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            installTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const browser = btn.getAttribute('data-browser');
            installContentItems.forEach(item => {
                if (item.id === `install-content-${browser}`) {
                    item.classList.add('active');
                } else {
                    item.classList.remove('active');
                }
            });
        });
    });

    // 7. FAQ Accordion Click-to-Expand
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach(question => {
        question.addEventListener('click', () => {
            const item = question.parentElement;
            const answer = item.querySelector('.faq-answer');
            const isActive = item.classList.contains('active');
            
            // Close all open FAQs
            document.querySelectorAll('.faq-item').forEach(faq => {
                faq.classList.remove('active');
                faq.querySelector('.faq-answer').style.maxHeight = null;
            });

            // If it wasn't active, open it
            if (!isActive) {
                item.classList.add('active');
                answer.style.maxHeight = answer.scrollHeight + "px";
            }
        });
    });

    // 8. Stats Counter Animation on Scroll
    const statsBar = document.querySelector('.stats-bar');
    const stat1 = document.getElementById('stat-1');
    const stat2 = document.getElementById('stat-2');
    const stat3 = document.getElementById('stat-3');

    let animated = false;

    const animateStats = () => {
        // Stat 1: 0% -> 100%
        let s1 = 0;
        const interval1 = setInterval(() => {
            if (s1 >= 100) {
                stat1.textContent = '100%';
                clearInterval(interval1);
            } else {
                s1 += 2;
                stat1.textContent = `${s1}%`;
            }
        }, 20);

        // Stat 2: 0s -> 0.2s
        let s2 = 0;
        const interval2 = setInterval(() => {
            if (s2 >= 2) {
                stat2.textContent = '0.2s';
                clearInterval(interval2);
            } else {
                s2 += 1;
                stat2.textContent = `0.${s2}s`;
            }
        }, 150);

        // Stat 3: 1-Click (Simple fade in effect already handled by text content)
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting && !animated) {
                animated = true;
                animateStats();
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    if (statsBar) {
        observer.observe(statsBar);
    }
});
