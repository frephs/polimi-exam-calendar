import { useState, useEffect, useRef, useCallback } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import confetti from 'canvas-confetti';
import { 
  Calendar as CalendarIcon, 
  Filter, 
  Sun, 
  Moon, 
  RefreshCw, 
  ChevronDown,
  Coffee, 
  Download, 
  Info, 
  Lock,
  Heart,
  Clock,
  Layers,
  Tag,
  Star
} from 'lucide-react';

const GithubIcon = ({ size = 18 }: { size?: number }) => (
  <svg 
    viewBox="0 0 24 24" 
    width={size} 
    height={size} 
    stroke="currentColor" 
    strokeWidth="2" 
    fill="none" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
  >
    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
  </svg>
);

const FirefoxIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M20.452 3.445a11.002 11.002 0 00-2.482-1.908C16.944.997 15.098.093 12.477.032c-.734-.017-1.457.03-2.174.144-.72.114-1.398.292-2.118.56-1.017.377-1.996.975-2.574 1.554.583-.349 1.476-.733 2.55-.992a10.083 10.083 0 013.729-.167c2.341.34 4.178 1.381 5.48 2.625a8.066 8.066 0 011.298 1.587c1.468 2.382 1.33 5.376.184 7.142-.85 1.312-2.67 2.544-4.37 2.53-.583-.023-1.438-.152-2.25-.566-2.629-1.343-3.021-4.688-1.118-6.306-.632-.136-1.82.13-2.646 1.363-.742 1.107-.7 2.816-.242 4.028a6.473 6.473 0 01-.59-1.895 7.695 7.695 0 01.416-3.845A8.212 8.212 0 019.45 5.399c.896-1.069 1.908-1.72 2.75-2.005-.54-.471-1.411-.738-2.421-.767C8.31 2.583 6.327 3.061 4.7 4.41a8.148 8.148 0 00-1.976 2.414c-.455.836-.691 1.659-.697 1.678.122-1.445.704-2.994 1.248-4.055-.79.413-1.827 1.668-2.41 3.042C.095 9.37-.2 11.608.14 13.989c.966 5.668 5.9 9.982 11.843 9.982C18.62 23.971 24 18.591 24 11.956a11.93 11.93 0 00-3.548-8.511z" />
  </svg>
);



const ChromeIcon = ({ size = 14 }: { size?: number }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="currentColor"
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M12 0C8.21 0 4.831 1.757 2.632 4.501l3.953 6.848A5.454 5.454 0 0 1 12 6.545h10.691A12 12 0 0 0 12 0zM1.931 5.47A11.943 11.943 0 0 0 0 12c0 6.012 4.42 10.991 10.189 11.864l3.953-6.847a5.45 5.45 0 0 1-6.865-2.29zm13.342 2.166a5.446 5.446 0 0 1 1.45 7.09l.002.001h-.002l-5.344 9.257c.206.01.413.016.621.016 6.627 0 12-5.373 12-12 0-1.54-.29-3.011-.818-4.364zM12 16.364a4.364 4.364 0 1 1 0-8.728 4.364 4.364 0 0 1 0 8.728Z" />
  </svg>
);

const LogoIcon = ({ size = 24 }: { size?: number }) => (
  <img
    src={`${import.meta.env.BASE_URL}icon.svg`}
    alt="Polimi Exam Calendar"
    width={size}
    height={size}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  />
);


// ============================================================================
// Constants & Settings matching content_script.ts
// ============================================================================
const EVENT_COLORS = {
  PUBLISHED: '#9C27B0',
  AWAITING: '#B8860B',
  ENROLLED: '#4CAF50',
  NOT_ENROLLED: '#2196F3',
  DEADLINE: '#D32F2F',
};

const customItLocale = {
  code: 'it',
  week: { dow: 1, doy: 4 },
  buttonText: {
    today: 'Oggi',
    month: 'Mese',
    week: 'Settimana',
    day: 'Giorno',
    list: 'Agenda'
  },
  allDayText: 'Tutto il giorno',
  noEventsText: 'Nessun esame da visualizzare'
};

interface CalendarEvent {
  id: string;
  title: string;
  start: string;
  end?: string;
  allDay?: boolean;
  color: string;
  extendedProps: {
    room?: string;
    status: keyof typeof EVENT_COLORS;
    result?: string;
    articleIndex: number;
  };
}

const getDynamicDate = (day: number) => {
  const now = new Date();
  const year = now.getFullYear();
  const lastDayOfMonth = new Date(year, now.getMonth() + 1, 0).getDate();
  const safeDay = Math.min(day, lastDayOfMonth);
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const dayStr = String(safeDay).padStart(2, '0');
  return `${year}-${month}-${dayStr}`;
};

const MOCK_EVENTS: CalendarEvent[] = [
  {
    id: '14',
    title: 'ML',
    start: getDynamicDate(8),
    allDay: true,
    color: EVENT_COLORS.PUBLISHED,
    extendedProps: { room: 'B.2.2', status: 'PUBLISHED', result: '28', articleIndex: 0 }
  },
  {
    id: '15',
    title: 'Scadenza: ML',
    start: getDynamicDate(11),
    allDay: true,
    color: EVENT_COLORS.DEADLINE,
    extendedProps: { status: 'DEADLINE', articleIndex: 0 }
  },
  {
    id: '1',
    title: 'DB 2',
    start: getDynamicDate(12),
    allDay: true,
    color: EVENT_COLORS.AWAITING,
    extendedProps: { room: 'B.2.2', status: 'AWAITING', articleIndex: 0 }
  },
  {
    id: '2',
    title: 'FLC',
    start: getDynamicDate(16),
    allDay: true,
    color: EVENT_COLORS.AWAITING,
    extendedProps: { room: 'T.2.3', status: 'AWAITING', articleIndex: 1 }
  },
  {
    id: '3',
    title: 'CI',
    start: getDynamicDate(19),
    allDay: true,
    color: EVENT_COLORS.AWAITING,
    extendedProps: { room: 'B.4.1', status: 'AWAITING', articleIndex: 3 }
  },
  {
    id: '4',
    title: 'ACA',
    start: getDynamicDate(22),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: 'De Donato', status: 'NOT_ENROLLED', articleIndex: 2 }
  },
  {
    id: '5',
    title: 'SE 2',
    start: getDynamicDate(25),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: 'B.2.2', status: 'NOT_ENROLLED', articleIndex: 0 }
  },
  {
    id: '6',
    title: 'MIDA',
    start: getDynamicDate(26),
    allDay: true,
    color: EVENT_COLORS.ENROLLED,
    extendedProps: { room: 'Beltrami', status: 'ENROLLED', articleIndex: 4 }
  },
  {
    id: '7',
    title: 'DS',
    start: getDynamicDate(30),
    allDay: true,
    color: EVENT_COLORS.ENROLLED,
    extendedProps: { room: 'B.4.1', status: 'ENROLLED', articleIndex: 3 }
  },
  {
    id: '8',
    title: 'DB 2',
    start: getDynamicDate(2),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: 'B.2.2', status: 'NOT_ENROLLED', articleIndex: 0 }
  },
  {
    id: '9',
    title: 'AOS',
    start: getDynamicDate(3),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: 'T.2.3', status: 'NOT_ENROLLED', articleIndex: 1 }
  },
  {
    id: '10',
    title: 'CS',
    start: getDynamicDate(6),
    allDay: true,
    color: EVENT_COLORS.ENROLLED,
    extendedProps: { room: 'De Donato', status: 'ENROLLED', articleIndex: 2 }
  },
  {
    id: '11',
    title: 'FAI',
    start: getDynamicDate(7),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: 'Beltrami', status: 'NOT_ENROLLED', articleIndex: 4 }
  },
  {
    id: '12',
    title: 'FLC',
    start: getDynamicDate(9),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: '6.0.1', status: 'NOT_ENROLLED', articleIndex: 1 }
  },
  {
    id: '13',
    title: 'CI',
    start: getDynamicDate(10),
    allDay: true,
    color: EVENT_COLORS.NOT_ENROLLED,
    extendedProps: { room: 'B.4.1', status: 'NOT_ENROLLED', articleIndex: 3 }
  }
];

export default function App() {
  // Page States
  const [isLightTheme, setIsLightTheme] = useState<boolean>(() => {
    return localStorage.getItem('theme') === 'light';
  });
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  // Install Redirect Modal State
  const [installModal, setInstallModal] = useState<{
    show: boolean;
    url: string;
    label: string;
  }>({ show: false, url: '', label: '' });
  const [installProgress, setInstallProgress] = useState(0);
  const installTimerRef = useRef<number | null>(null);

  // Mockup Window States
  const mockTheme = isLightTheme ? 'light' : 'dark';
  const [showSettingsPopup, setShowSettingsPopup] = useState<boolean>(false);
  const [settingsLinkType, setSettingsLinkType] = useState<'anxious-display' | 'exam-article' | 'download-ics'>('exam-article');
  
  // Status Filters State
  const [filters, setFilters] = useState<Record<keyof typeof EVENT_COLORS, boolean>>({
    ENROLLED: true,
    NOT_ENROLLED: true,
    PUBLISHED: true,
    AWAITING: true,
    DEADLINE: true,
  });

  // Modal State
  const [ateneoModal, setAteneoModal] = useState<{
    show: boolean;
    title: string;
    message: string;
    confirmAction?: () => void;
  }>({
    show: false,
    title: '',
    message: '',
  });

  // Notification Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [showSaveSuccess, setShowSaveSuccess] = useState<boolean>(false);

  const [latestVersion, setLatestVersion] = useState<string>(`v${import.meta.env.VITE_APP_VERSION || '4.2.0'}`);
  const [starCount, setStarCount] = useState<number | null>(null);

  useEffect(() => {
    fetch('https://api.github.com/repos/frephs/polimi-exam-calendar/releases/latest')
      .then(res => {
        if (!res.ok) throw new Error('API response error');
        return res.json();
      })
      .then(data => {
        if (data.tag_name) {
          setLatestVersion(data.tag_name);
        }
      })
      .catch(err => {
        console.warn('Could not fetch latest release version from GitHub:', err);
      });

    fetch('https://api.github.com/repos/frephs/polimi-exam-calendar')
      .then(res => {
        if (!res.ok) throw new Error('API response error');
        return res.json();
      })
      .then(data => {
        if (typeof data.stargazers_count === 'number') {
          setStarCount(data.stargazers_count);
        }
      })
      .catch(err => {
        console.warn('Could not fetch stargazers count from GitHub:', err);
      });
  }, []);

  // Theme Syncing Effect
  useEffect(() => {
    if (isLightTheme) {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
    } else {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightTheme]);

  // Toast Timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Card Mouse Glow Effect Ref
  const featuresRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!featuresRef.current) return;
      const cards = featuresRef.current.querySelectorAll('.feature-card');
      cards.forEach((card: any) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Install Modal Timer
  const openInstallModal = useCallback((url: string, label: string) => {
    setInstallModal({ show: true, url, label });
    setInstallProgress(0);
    const start = Date.now();
    const duration = 10000;
    const interval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min((elapsed / duration) * 100, 100);
      setInstallProgress(pct);
      if (elapsed >= duration) {
        window.clearInterval(interval);
        window.open(url, '_blank');
        setInstallModal({ show: false, url: '', label: '' });
      }
    }, 50);
    installTimerRef.current = interval;
  }, []);

  const closeInstallModal = useCallback(() => {
    if (installTimerRef.current) window.clearInterval(installTimerRef.current);
    setInstallModal({ show: false, url: '', label: '' });
    setInstallProgress(0);
  }, []);

  const handleInstallClick = useCallback(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('firefox')) {
      openInstallModal('https://addons.mozilla.org/en-US/firefox/addon/polimi-exam-calendar/', 'Firefox Add-ons');
    } else {
      openInstallModal('https://github.com/frephs/polimi-exam-calendar/releases', 'GitHub Releases');
    }
  }, [openInstallModal]);

  // Filtered Events computed property
  const filteredEvents = MOCK_EVENTS.filter(event => filters[event.extendedProps.status]);

  // Simulated Save settings
  const handleSettingsChange = (type: typeof settingsLinkType) => {
    setSettingsLinkType(type);
    setShowSaveSuccess(true);
    setTimeout(() => {
      setShowSaveSuccess(false);
    }, 2000);
  };

  // FullCalendar eventClick logic mimicking handleEventClick in content_script.ts
  const handleEventClick = (info: any) => {
    const event = info.event;
    const title = event.title;
    
    if (settingsLinkType === 'download-ics') {
      info.jsEvent.preventDefault();
      setAteneoModal({
        show: true,
        title: 'Download Exam Calendar Event',
        message: `Do you want to download the ICS file for this exam?\n\n${title}`,
        confirmAction: () => {
          downloadMockIcs(title);
          setAteneoModal(prev => ({ ...prev, show: false }));
          setToastMessage(`Downloaded ICS file for ${title}!`);
          confetti({
            particleCount: 80,
            spread: 50,
            origin: { y: 0.8 }
          });
        }
      });
    } else if (settingsLinkType === 'anxious-display') {
      info.jsEvent.preventDefault();
      setToastMessage(`Simulating redirect to Anxious Display for: ${title}`);
    } else {
      info.jsEvent.preventDefault();
      setToastMessage(`Simulating scroll to Exam Article on Polimi registration page for: ${title}`);
    }
  };

  // Generate and download a mock ICS file
  const downloadMockIcs = (eventTitle: string) => {
    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Polimi Exam Calendar//EN',
      'BEGIN:VEVENT',
      `SUMMARY:${eventTitle}`,
      'DTSTART:20260625T091500Z',
      'DTEND:20260625T111500Z',
      'LOCATION:Politecnico di Milano - Exam Session',
      'DESCRIPTION:Simulated export from Polimi Exam Calendar extension.',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${eventTitle.replace(/\s+/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // FullCalendar event Content renderer mimicking extension structure
  const renderEventContent = (eventInfo: any) => {
    const timeText = eventInfo.timeText;
    const title = eventInfo.event.title;
    const room = eventInfo.event.extendedProps?.room || '';

    const getRoomDisplay = (text: string): string => {
      const val = text.trim();
      const normalized = val.toLowerCase();
      if (
        !normalized ||
        normalized.includes('non ancora disponibili') ||
        normalized.includes('not yet available') ||
        normalized.includes('non disponibile') ||
        normalized.includes('n.d.') ||
        normalized === 'nd'
      ) {
        return '';
      }
      return val;
    };

    const roomText = getRoomDisplay(room);

    return (
      <div className="fc-event-custom-container">
        {timeText && <span className="fc-event-time">{timeText}</span>}
        <span className="fc-event-title">{title}</span>
        {roomText && <span className="fc-event-room">{roomText}</span>}
      </div>
    );
  };

  return (
    <>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#1e293b',
          color: '#f8fafc',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
          zIndex: 99999,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          fontWeight: '500',
          border: '1px solid rgba(255,255,255,0.1)',
          animation: 'slideUp 0.3s ease-out'
        }}>
          <Info size={16} className="text-blue-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Background Orbs */}
      <div className="glow-orb orb-top-right"></div>
      <div className="glow-orb orb-bottom-left"></div>

      {/* Navigation Header */}
      <header className="header">
        <div className="nav-container">
          <a href="#" className="logo">
            <LogoIcon size={28} />
            <span>Polimi Exam Calendar</span>
          </a>
          
          <ul className="nav-menu">
            <li><a href="#features" className="nav-link">Features</a></li>
            <li><a href="#how-it-works" className="nav-link">Installation</a></li>
            <li><a href="#faq" className="nav-link">FAQ</a></li>
            <li><a href="#support" className="nav-link" onClick={(e) => { e.preventDefault(); document.querySelector('.donate')?.scrollIntoView({ behavior: 'smooth' }); }}>Support</a></li>
          </ul>

          <div className="nav-actions">
            <button 
              className="btn-icon-only" 
              onClick={() => setIsLightTheme(prev => !prev)}
              aria-label="Toggle Page Theme"
            >
              {isLightTheme ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <a 
              href="https://github.com/frephs/polimi-exam-calendar" 
              target="_blank" 
              rel="noreferrer" 
              className="btn btn-secondary nav-star-btn"
              style={{ gap: '6px', display: 'inline-flex', alignItems: 'center', padding: '6px 12px', borderRadius: '8px', fontSize: '13px' }}
              aria-label="Star on GitHub"
            >
              <Star size={14} style={{ fill: '#eab308', color: '#eab308' }} />
              <span>Star</span>
              {starCount !== null && (
                <span className="star-count-badge" style={{
                  backgroundColor: 'rgba(255,255,255,0.15)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 600,
                  marginLeft: '4px'
                }}>{starCount}</span>
              )}
            </a>
            <button 
              onClick={handleInstallClick} 
              className="btn btn-primary nav-install-btn"
              style={{ gap: '6px' }}
            >
              <Download size={14} />
              <span className="nav-install-btn-text">Install Now</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero">
        <div className="hero-badges">
          <div className="badge online-badge">
            <span className="status-dot-green"></span>
            <span>Online</span>
          </div>
          <div className="badge verified-badge">
            <FirefoxIcon size={14} />
            <span>Firefox Verified</span>
          </div>
          <div className="badge verified-badge">
            <ChromeIcon size={14} />
            <span>Chrome Compatible</span>
          </div>
          <div className="badge version-badge">
            <Tag size={12} style={{ opacity: 0.8 }} />
            <span style={{ fontWeight: 600 }}>{latestVersion}</span>
          </div>
        </div>
        <h1 className="hero-title">Polimi Exam Calendar</h1>
        <p className="hero-subtitle">
          Streamline your exam session at Politecnico with a clean, modern, interactive scheduling tool. Filter exams by status and export to Google or Apple Calendar in seconds.
        </p>
        <div className="hero-ctas">
          <button onClick={handleInstallClick} className="btn btn-primary" style={{ gap: '8px' }}>
            <Download size={16} />
            <span>Install Extension</span>
          </button>
          <a 
            href="https://github.com/frephs/polimi-exam-calendar" 
            target="_blank" 
            rel="noreferrer" 
            className="btn btn-secondary hero-star-btn" 
            style={{ gap: '8px', display: 'inline-flex', alignItems: 'center' }}
          >
            <Star size={16} style={{ fill: '#eab308', color: '#eab308' }} />
            <span>Star on GitHub</span>
            {starCount !== null && (
              <span className="star-count-badge" style={{
                backgroundColor: 'rgba(255,255,255,0.15)',
                padding: '2px 8px',
                borderRadius: '12px',
                fontSize: '12px',
                fontWeight: 600
              }}>{starCount}</span>
            )}
          </a>
          <a 
            href="https://github.com/frephs/polimi-exam-calendar" 
            target="_blank" 
            rel="noreferrer" 
            className="btn btn-secondary" 
            style={{ gap: '8px' }}
          >
            <GithubIcon size={16} />
            <span>View Source Code</span>
          </a>
        </div>

        {/* INTERACTIVE MOCKUP SHOWCASE */}
        <div className="mockup-wrapper">
          <div className="mockup-container">
          <div className="mockup-header">
            <div className="mockup-dots">
              <span className="mockup-dot red"></span>
              <span className="mockup-dot yellow"></span>
              <span className="mockup-dot green"></span>
            </div>
            
            <div className="mockup-search-bar" style={{ position: 'relative', flexGrow: 1, maxWidth: '500px' }}>
              <Lock size={10} style={{ color: '#10b981' }} />
              <span>onlineservices.polimi.it/iae/app/</span>
              {/* Trigger button absolute-positioned on the right */}
              <button 
                onClick={() => setShowSettingsPopup(prev => !prev)}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '4px',
                  color: 'var(--polimiAccent1Dark)'
                }}
                className="extension-trigger-btn"
                title="Open calendar settings"
              >
                <LogoIcon size={14} />
              </button>
            </div>

            <div className="mockup-actions">
              <button 
                className="mockup-action-btn"
                onClick={() => {
                  setFilters({
                    ENROLLED: true,
                    NOT_ENROLLED: true,
                    PUBLISHED: true,
                    AWAITING: true,
                    DEADLINE: true,
                  });
                  setToastMessage("Mockup reloaded!");
                }}
                title="Reset simulation data"
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Mockup Frame Content */}
          <div id="mockup-body" className={`mockup-body mock-theme-${mockTheme}`} style={{ height: '560px', overflow: 'hidden' }}>
            {/* Simulated Ateneo Confirmation Dialog */}
            <div className={`ateneo-modal-backdrop ${ateneoModal.show ? 'show' : ''}`}>
              <div className="ateneo-modal-container">
                <div className="ateneo-modal-header">{ateneoModal.title}</div>
                <div className="ateneo-modal-body">{ateneoModal.message}</div>
                <div className="ateneo-modal-footer">
                  <button 
                    className="ateneo-btn ateneo-btn-secondary" 
                    onClick={() => setAteneoModal(prev => ({ ...prev, show: false }))}
                  >
                    Cancel
                  </button>
                  <button 
                    className="ateneo-btn ateneo-btn-primary"
                    onClick={ateneoModal.confirmAction}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            </div>

            {/* Portal Header */}
            <div className="ateneo-header" style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px 8px 16px',
              borderBottom: '1px solid var(--polimi20)',
              backgroundColor: 'var(--white-white-special)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ color: 'var(--polimiAccent1Dark)', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}>←</span>
                <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text-dark)' }}>Esami</h1>
              </div>
              <div style={{
                width: '20px',
                height: '20px',
                borderRadius: '50%',
                border: '1.5px solid var(--polimiAccent1Dark)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--polimiAccent1Dark)',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer'
              }}>
                i
              </div>
            </div>

            {/* Portal Tabs */}
            <div className="ateneo-tabs">
              <div style={{
                padding: '10px 0',
                color: 'var(--polimiAccent1Dark)',
                borderBottom: '3px solid var(--polimiAccent1Dark)',
                fontWeight: 700,
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                Insegnamenti da sostenere
              </div>
              <div style={{
                padding: '10px 0',
                color: 'var(--polimiGreyBlue)',
                fontWeight: 500,
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                Iscrizioni effettuate
              </div>
              <div style={{
                padding: '10px 0',
                color: 'var(--polimiGreyBlue)',
                fontWeight: 500,
                fontSize: '12px',
                cursor: 'pointer'
              }}>
                Esiti
              </div>
            </div>

            {/* Webpage Content */}
            <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', backgroundColor: 'var(--white-white-special)', padding: '6px 12px 12px 12px', overflow: 'hidden' }}>
              
              {/* FullCalendar instance */}
              <div style={{ flexGrow: 1, overflow: 'hidden', minHeight: '320px', height: '0px' }}>
                <FullCalendar
                  plugins={[dayGridPlugin, timeGridPlugin, listPlugin]}
                  initialView="dayGridMonth"
                  initialDate="2026-06-22"
                  headerToolbar={{
                    left: 'dayGridMonth,listMonth',
                    center: 'title',
                    right: 'prev,next today'
                  }}
                  locale={customItLocale}
                  events={filteredEvents}
                  eventClick={handleEventClick}
                  eventDidMount={(info) => {
                    const color = info.event.backgroundColor || info.event.borderColor;
                    if (color) {
                      info.el.style.setProperty('--fc-event-border-color', color);
                      info.el.style.setProperty('--fc-event-bg-color', color);
                    }
                  }}
                  eventContent={renderEventContent}
                  height="100%"
                />
              </div>

              {/* Legend bar */}
              <div id="calendar-legend" style={{ margin: '8px 0', padding: '6px 10px', display: 'flex', gap: '10px', alignItems: 'center', fontSize: '11px', flexWrap: 'wrap', border: '1px solid var(--polimi20)', borderRadius: '6px', backgroundColor: 'var(--white-white-special)', flexShrink: 0 }}>
                <strong style={{ color: 'var(--text-dark)' }}>Legenda:</strong>
                <label className="legend-filter-item">
                  <input 
                    type="checkbox" 
                    className="legend-filter-checkbox" 
                    style={{ '--checkbox-color': EVENT_COLORS.PUBLISHED } as any}
                    checked={filters.PUBLISHED}
                    onChange={(e) => setFilters(prev => ({ ...prev, PUBLISHED: e.target.checked }))}
                  />
                  <span>Esito pubblicato</span>
                </label>
                <label className="legend-filter-item">
                  <input 
                    type="checkbox" 
                    className="legend-filter-checkbox" 
                    style={{ '--checkbox-color': EVENT_COLORS.AWAITING } as any}
                    checked={filters.AWAITING}
                    onChange={(e) => setFilters(prev => ({ ...prev, AWAITING: e.target.checked }))}
                  />
                  <span>In attesa di esito</span>
                </label>
                <label className="legend-filter-item">
                  <input 
                    type="checkbox" 
                    className="legend-filter-checkbox" 
                    style={{ '--checkbox-color': EVENT_COLORS.NOT_ENROLLED } as any}
                    checked={filters.NOT_ENROLLED}
                    onChange={(e) => setFilters(prev => ({ ...prev, NOT_ENROLLED: e.target.checked }))}
                  />
                  <span>Non iscritto</span>
                </label>
                <label className="legend-filter-item">
                  <input 
                    type="checkbox" 
                    className="legend-filter-checkbox" 
                    style={{ '--checkbox-color': EVENT_COLORS.ENROLLED } as any}
                    checked={filters.ENROLLED}
                    onChange={(e) => setFilters(prev => ({ ...prev, ENROLLED: e.target.checked }))}
                  />
                  <span>Iscritto</span>
                </label>
                <label className="legend-filter-item">
                  <input 
                    type="checkbox" 
                    className="legend-filter-checkbox" 
                    style={{ '--checkbox-color': EVENT_COLORS.DEADLINE } as any}
                    checked={filters.DEADLINE}
                    onChange={(e) => setFilters(prev => ({ ...prev, DEADLINE: e.target.checked }))}
                  />
                  <span>Scadenza rifiuto</span>
                </label>
              </div>

              {/* Export buttons */}
              <div style={{ display: 'flex', gap: '10px', margin: '4px 0 0 0', flexWrap: 'wrap', flexShrink: 0 }}>
                <button 
                  className="p-button p-component" 
                  onClick={() => {
                    confetti({
                      particleCount: 120,
                      spread: 60,
                      origin: { y: 0.8 }
                    });
                    setToastMessage("Esportazione ICS completata con successo!");
                  }}
                >
                  Esporta gli esami a cui sei iscritto come ICS
                </button>
                <button 
                  className="p-button p-component" 
                  onClick={() => {
                    window.open("https://the-anxious-display.vercel.app/", "_blank");
                  }}
                >
                  Esporta gli esami a cui sei iscritto in Anxious Display
                </button>
              </div>
            </div>

            {/* Floating Simulated Settings Popup */}
            {showSettingsPopup && (
              <div 
                className="simulated-popup" 
                style={{
                  position: 'absolute',
                  top: '40px',
                  right: '12px',
                  width: '280px',
                  backgroundColor: 'var(--white-white-special)',
                  border: '1px solid var(--polimi20)',
                  borderRadius: '12px',
                  boxShadow: '0 10px 25px rgba(0, 0, 0, 0.15)',
                  padding: '16px',
                  zIndex: 1000,
                  fontFamily: 'var(--font-family, sans-serif)',
                  color: 'var(--text-dark)',
                  animation: 'fadeIn 0.2s ease-out'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--text-dark)' }}>Extension Settings</h4>
                  <button 
                    onClick={() => setShowSettingsPopup(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--polimiGreyBlue)', fontSize: '16px', fontWeight: 'bold' }}
                  >
                    ×
                  </button>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--polimiGreyBlue)', textTransform: 'uppercase' }}>
                    Click Behavior
                  </label>
                  
                  <label className="radio-option" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', padding: '8px', borderRadius: '6px', border: '1px solid var(--polimi20)', margin: 0 }}>
                    <input 
                      type="radio" 
                      name="link-type" 
                      value="exam-article"
                      checked={settingsLinkType === 'exam-article'}
                      onChange={() => handleSettingsChange('exam-article')}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 600 }}>Scroll to exam details</div>
                      <div style={{ fontSize: '10px', color: 'var(--polimiGreyBlue)' }}>Highlight card on portal page</div>
                    </div>
                  </label>

                  <label className="radio-option" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', padding: '8px', borderRadius: '6px', border: '1px solid var(--polimi20)', margin: 0 }}>
                    <input 
                      type="radio" 
                      name="link-type" 
                      value="anxious-display"
                      checked={settingsLinkType === 'anxious-display'}
                      onChange={() => handleSettingsChange('anxious-display')}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 600 }}>Open Anxious Display</div>
                      <div style={{ fontSize: '10px', color: 'var(--polimiGreyBlue)' }}>Redirect to countdown countdowns</div>
                    </div>
                  </label>

                  <label className="radio-option" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer', padding: '8px', borderRadius: '6px', border: '1px solid var(--polimi20)', margin: 0 }}>
                    <input 
                      type="radio" 
                      name="link-type" 
                      value="download-ics"
                      checked={settingsLinkType === 'download-ics'}
                      onChange={() => handleSettingsChange('download-ics')}
                      style={{ marginTop: '3px' }}
                    />
                    <div style={{ fontSize: '12px' }}>
                      <div style={{ fontWeight: 600 }}>Download single ICS</div>
                      <div style={{ fontSize: '10px', color: 'var(--polimiGreyBlue)' }}>Direct event calendar download</div>
                    </div>
                  </label>
                </div>
                
                {showSaveSuccess && (
                  <div style={{ fontSize: '11px', color: '#10b981', marginTop: '8px', fontWeight: 600, textAlign: 'center' }}>
                    ✓ Settings saved
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

        {/* Hero quick stats */}
        <div className="stats-bar">
          <div className="stat-item">
            <h3>4.8★</h3>
            <p>User Rating</p>
          </div>
          <div className="stat-item">
            <h3>{starCount !== null ? `${starCount}★` : '—'}</h3>
            <p>GitHub Stars</p>
          </div>
          <div className="stat-item">
            <h3>99.9%</h3>
            <p>Browser Compatible</p>
          </div>
          <div className="stat-item">
            <h3>100%</h3>
            <p>Secure & Open Source</p>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features" id="features" ref={featuresRef}>
        <h2 className="section-title">Engineered for Better Exam Organization</h2>
        <p className="section-subtitle">
          Enjoy premium features designed to streamline the chaotic registration panel and improve your college workflow.
        </p>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon" style={{ color: '#3b82f6', display: 'flex', alignItems: 'center' }}>
              <Filter size={32} />
            </div>
            <h3>Status-Based Color Coding</h3>
            <p>
              Instantly differentiate your exams by status (Enrolled, Not Enrolled, Result Published, Awaiting Results, and Rejection Deadline).
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
              <Info size={32} />
            </div>
            <h3>Classroom Location Tags</h3>
            <p>
              Room numbers and building identifiers are extracted and displayed as convenient badges directly on your calendar event cards.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ color: '#ef4444', display: 'flex', alignItems: 'center' }}>
              <CalendarIcon size={32} />
            </div>
            <h3>Flexible Export Controls</h3>
            <p>
              Download single exam events or export your entire registration list into standard <code>.ics</code> calendar files compatible with your calendar app of choice.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ color: '#8b5cf6', display: 'flex', alignItems: 'center' }}>
              <Filter size={32} />
            </div>
            <h3>Status Filtering</h3>
            <p>
              Hide or display exams dynamically based on their registration state. Toggle Enrolled, Published, and Awaiting results to clean up your view and focus on what's next.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ color: '#ec4899', display: 'flex', alignItems: 'center' }}>
              <Clock size={32} />
            </div>
            <h3>Countdown Integration</h3>
            <p>
              Link your schedule directly with Anxious Display. Seamlessly track exactly how many days, hours, and minutes remain until your next big exam session.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon" style={{ color: '#10b981', display: 'flex', alignItems: 'center' }}>
              <Layers size={32} />
            </div>
            <h3>At-a-Glance Planning</h3>
            <p>
              Access essential exam information, status badges, and direct actions instantly from a unique calendar layout.
            </p>
          </div>
        </div>

        
      </section>

      {/* Installation Step-by-Step Guide */}
      <section className="install-guide" id="how-it-works">
        <h2 className="section-title">Simple Installation</h2>
        <p className="section-subtitle">Get the extension running in under 60 seconds.</p>

        <div className="steps-container">
          <div className="step-card">
            <div className="step-num">1</div>
            <div className="step-content">
              <h3>Install the Web Extension</h3>
              <p>
                Click "Install Extension" to download the package directly from your browser's store. We support both Google Chrome, Microsoft Edge, and Mozilla Firefox.
              </p>
            </div>
          </div>

          <div className="step-card">
            <div className="step-num">2</div>
            <div className="step-content">
              <h3>Go to Exam Registration</h3>
              <p>
                Use the extension popup to navigate to the Politecnico di Milano Online Services portal and open the "Exam Registration" page (<code>/iae/app/</code>).
              </p>
            </div>
          </div>

          <div className="step-card">
            <div className="step-num">3</div>
            <div className="step-content">
              <h3>Enjoy the Clean View</h3>
              <p>
                The extension automatically parses the table, extracts classroom locations, assigns colors to exam statuses, and displays the interactive schedule container.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq" id="faq">
        <h2 className="section-title">Frequently Asked Questions</h2>
        <p className="section-subtitle">Got questions? We have answers.</p>

        <div className="faq-list">
          {[
            {
              q: "Does this extension store or upload my student data?",
              a: "Absolutely not. The extension runs entirely in your local browser sandbox. It parses the HTML structure of the registration page client-side to generate the calendar layout and never sends any personal or academic information to external servers."
            },
            {
              q: "How does the single event export work?",
              a: "When you click on an event in the calendar while the setting 'Download single event' is enabled, the extension dynamically converts the exam details (title, dates, room locations) into a standard ICS file and triggers a browser download. You can then open this file in Google Calendar, Outlook, or Apple Calendar."
            },
            {
              q: "What is the Anxious Display integration?",
              a: "Anxious Display is a companion web app that lets you visualize your enrolled exams as a live countdown dashboard. When this option is enabled in the extension settings, clicking an event will redirect you to the Anxious Display page pre-populated with your exam data, giving you a real-time view of days and hours remaining."
            },
            {
              q: "Why is the extension not on the Chrome Web Store?",
              a: "Publishing on the Chrome Web Store requires a one-time $5 developer registration fee. Since this is a free, open-source student project, we haven't covered that cost yet. In the meantime, you can install it on Chrome/Edge by loading the unpacked extension from the GitHub release, or use the Firefox Add-ons store where it's already published for free."
            }
          ].map((item, idx) => (
            <div className="faq-item" key={idx}>
              <button 
                className="faq-question"
                onClick={() => setOpenFaqIndex(openFaqIndex === idx ? null : idx)}
              >
                <span>{item.q}</span>
                <ChevronDown 
                  size={16} 
                  style={{
                    transform: openFaqIndex === idx ? 'rotate(180deg)' : 'rotate(0)',
                    transition: 'transform 0.3s ease'
                  }}
                />
              </button>
              <div 
                className="faq-answer"
                style={{
                  maxHeight: openFaqIndex === idx ? '200px' : '0'
                }}
              >
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Donate / Support Section */}
      <section className="donate" id="support">
        <h2 className="section-title">Support the Project</h2>
        <p className="section-subtitle">Built by students, for students. Help us keep it going.</p>
        
        <div className="support-container">
          {/* About the Developer */}
          <div className="developer-card">
            <img src={`${import.meta.env.BASE_URL}francesco.jpg`} alt="Francesco Genovese" className="developer-avatar" />
            <div className="developer-info">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                <h3 style={{ margin: 0 }}>Francesco Genovese</h3>
                <span className="dev-tag">Developer</span>
              </div>
              <h4 style={{ marginTop: 0 }}>Computer Science & Engineering Student @ Polimi</h4>
              <p>
                Planning an exam session can be stressful, Polimi Exam Calendar helps do it best.
              </p>
            </div>
          </div>

          {/* Support options */}
          <div className="donate-card">
            <Heart size={32} className="text-red-500" style={{ margin: '0 auto 12px', color: '#ef4444' }} />
            <h3>Support the Project</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px', marginBottom: '20px' }}>
              If the extension helped you organize your session and save time, consider buying me a coffee or donating via PayPal to support its maintenance!
            </p>
            <div className="donate-buttons">
              <a 
                href="https://ko-fi.com/frephs" 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-secondary"
                style={{ gap: '8px', background: '#FFDD00', color: '#000000', borderColor: '#FFDD00' }}
              >
                <Coffee size={16} />
                <span>Buy Me a Coffee</span>
              </a>
              <a 
                href="https://paypal.me/frncscgnvs" 
                target="_blank" 
                rel="noreferrer" 
                className="btn btn-primary"
                style={{ gap: '8px', background: '#003087' }}
              >
                <Heart size={16} />
                <span>Donate via PayPal</span>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Install Redirect Modal */}
      {installModal.show && (
        <div className="install-modal-overlay" onClick={closeInstallModal}>
          <div className="install-modal" onClick={(e) => e.stopPropagation()}>
            <button className="install-modal-close" onClick={closeInstallModal} aria-label="Close">&times;</button>
            <Heart size={36} style={{ color: '#ef4444', margin: '0 auto 12px', display: 'block' }} />
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)' }}>Before you go...</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 20px', lineHeight: 1.5 }}>
              Polimi Exam Calendar is built and maintained by students, for students. If it helped you, consider supporting the project!
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px', flexWrap: 'wrap' }}>
              <a
                href="https://buymeacoffee.com"
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ gap: '8px', background: '#FFDD00', color: '#000', borderColor: '#FFDD00', fontSize: '13px', padding: '8px 16px' }}
              >
                <Coffee size={14} />
                <span>Buy Me a Coffee</span>
              </a>
              <a
                href="https://paypal.me"
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ gap: '8px', background: '#003087', fontSize: '13px', padding: '8px 16px' }}
              >
                <Heart size={14} />
                <span>Donate via PayPal</span>
              </a>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 8px', textAlign: 'center' }}>
              Redirecting to <strong>{installModal.label}</strong> in {Math.max(1, Math.ceil((100 - installProgress) / 100 * 10))}s...
            </p>
            <div className="install-modal-progress-track">
              <div className="install-modal-progress-bar" style={{ width: `${installProgress}%` }} />
            </div>
            <button
              className="btn btn-secondary"
              style={{ marginTop: '12px', fontSize: '12px', padding: '6px 16px', width: '100%' }}
              onClick={() => {
                closeInstallModal();
                window.open(installModal.url, '_blank');
              }}
            >
              Skip & Install Now
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="footer">
        <div className="footer-container">
          <span className="footer-text">
            © {new Date().getFullYear()} Polimi Exam Calendar. MIT Licensed.
          </span>
          <div className="footer-links">
            <a href="https://github.com/frephs/polimi-exam-calendar" target="_blank" rel="noreferrer" className="footer-link">GitHub</a>
            <a href="https://github.com/frephs/polimi-exam-calendar/blob/main/LICENSE" target="_blank" rel="noreferrer" className="footer-link">License</a>
          </div>
        </div>
      </footer>
    </>
  );
}
