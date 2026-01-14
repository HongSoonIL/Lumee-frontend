// src/screens/Home/Home.js

import React, { useState, useEffect, useRef } from 'react';
import './Home.css';
import { WeatherDescriptionWithIcon } from './weatherIconUtils';
import PlanCard from './PlanCard';
import { schedules } from './schedules';

// Firebase 로그인 함수 import
import { signInWithGoogle, logout } from '../../firebase';

// ===== 날짜/캘린더 유틸 =====
const weekdayShort = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

function formatDate(date) {
  const options = { month: 'short', day: 'numeric', weekday: 'long' };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);

  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  const weekday = parts.find((p) => p.type === 'weekday').value;

  return `${month} ${day}, ${weekday}`;
}

function formatMonthYear(date) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(date); // ex) December 2025
}

// 🔒 캘린더를 14~20일로 고정해서 보여주는 함수
function getWeekDates(baseDate) {
  const d = new Date(baseDate);
  const year = d.getFullYear();
  const month = d.getMonth();

  const arr = [];
  for (let i = 0; i < 7; i++) {
    // 14,15,16,17,18,19,20일 고정
    arr.push(new Date(year, month, 14 + i));
  }
  return arr;
}

function isSameDay(a, b) {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

// fetchCalendarEvents는 Home 컴포넌트 내부로 이동됨

const Home = ({
  time,
  location,
  input,
  setInput,
  handleSend,
  sendFromFAQ,
  handleVoiceInput,
  weather,
  uid,
  user,
  setView,
  onCameraClick,
}) => {
  // 현재 사용자 정보 처리 로직 변경
  // 로그인한 경우 user 정보를 쓰고, 아니면 기본 게스트 정보 표시
  const currentUser = user ? {
    name: user.displayName || 'User',
    image: user.photoURL || `${process.env.PUBLIC_URL}/assets/icons/default_user.png`,
    greeting: `Hello, ${user.displayName?.split(' ')[0] || 'There'}👋`
  } : {
    name: 'Guest',
    image: `${process.env.PUBLIC_URL}/assets/icons/default_user.png`, // 기본 아이콘
    greeting: 'Please Sign In 👋'
  };

  // ===== Google Calendar 일정 State =====
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // ✨ 백엔드로부터 Google Calendar 일정 가져오기
  const fetchCalendarEvents = async () => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      console.log('❌ Access token not found');
      return;
    }

    setIsLoadingCalendar(true);
    try {
      const response = await fetch('http://localhost:4000/calendar/events', { //최종 배포시 http://localhost:4000 -> https://weather-assistant-backend1.onrender.com
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ accessToken: token }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const events = await response.json();
      console.log('✅ Google Calendar Events loaded:', events);
      console.log('📊 Events count:', events.length);

      // 백엔드 응답 형식을 프론트엔드 형식으로 변환
      const formattedEvents = events.map(event => {
        console.log('🔍 Processing event:', event);

        // ISO 8601 날짜를 YYYY-MM-DD 형식으로 변환
        let eventDate = event.date;
        if (event.start) {
          // ISO 형식인 경우 (예: 2026-01-16T18:30:00+09:00)
          eventDate = event.start.split('T')[0];
        } else if (event.date && event.date.includes('T')) {
          eventDate = event.date.split('T')[0];
        }

        const formatted = {
          ...event,
          date: eventDate, // YYYY-MM-DD 형식 보장
          title: event.title || event.summary || 'Untitled Event',
          tag: event.tag || 'Event',
          subtitle: event.location ? `📍 ${event.location}` : (event.subtitle || '#Calendar'),
          timeRange: event.timeRange || 'All day',
          etaText: event.etaText || '',
          body: event.body || event.description || '',
          location: event.location || ''
        };

        console.log('✨ Formatted event:', formatted);
        return formatted;
      });

      console.log('📅 Final formatted events:', formattedEvents);
      setCalendarEvents(formattedEvents);
    } catch (error) {
      console.error('❌ Failed to fetch calendar:', error);
      setCalendarEvents([]); // 오류 시 빈 배열로 설정
    } finally {
      setIsLoadingCalendar(false);
    }
  };

  // 프로필 버튼 클릭 핸들러 (로그인/로그아웃 토글)
  const handleProfileClick = async () => {
    if (user) {
      if (window.confirm("Do you want to logout?")) {
        await logout();
        localStorage.removeItem('googleAccessToken'); // 토큰 삭제
        setCalendarEvents([]); // 캘린더 일정 초기화
      }
    } else {
      const loggedInUser = await signInWithGoogle();
      if (loggedInUser) {
        // 로그인 성공 후 약간의 지연 후 캘린더 가져오기
        setTimeout(() => {
          fetchCalendarEvents();
        }, 1000);
      }
    }
  };

  // ✨ 컴포넌트 마운트 시 캘린더 로드
  useEffect(() => {
    if (user && localStorage.getItem('googleAccessToken')) {
      fetchCalendarEvents();
    }
  }, [user]); // user가 변경될 때마다 실행

  // ===== 날짜 =====
  const today = new Date();
  const formattedDate = formatDate(today);

  // 🔒 캘린더: 항상 이번 달 14~20일을 보여주되, 처음에는 선택 없음
  const calendarBaseDate = today;
  const [selectedDate, setSelectedDate] = useState(null);
  const weekDates = getWeekDates(calendarBaseDate);

  // ===== FAQ =====
  const defaultFaqItems = [
    "What's the weather like today?",
    "How's the air quality today?",
    'Do I need an umbrella today?',
    'What should I wear today?',
  ];

  const [faqItems, setFaqItems] = useState(() => {
    try {
      const savedFaqItems = localStorage.getItem('lumeeFaqItems');
      return savedFaqItems ? JSON.parse(savedFaqItems) : defaultFaqItems;
    } catch (error) {
      console.error('FAQ 데이터 로드 실패:', error);
      return defaultFaqItems;
    }
  });

  const [editingIndex, setEditingIndex] = useState(null);
  const [editText, setEditText] = useState('');

  // 👉 FAQ long-press용 ref들
  const longPressTimeoutRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const LONG_PRESS_DURATION = 600; // ms, 길게 누르는 기준 시간

  const startEditing = (index) => {
    setEditingIndex(index);
    setEditText(faqItems[index]);
  };

  // 🔥 FAQ 카드 길게 누르기 시작
  const handleFaqPressStart = (index) => {
    // 새로 시작할 때 초기화
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
    }
    longPressTriggeredRef.current = false;

    longPressTimeoutRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      startEditing(index);
    }, LONG_PRESS_DURATION);
  };

  // 🔥 손을 뗐을 때: 길게 누르기가 아니면 → 질문 보내기
  const handleFaqPressEnd = (faqText) => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }

    // 길게 누르기 이미 발동했으면, 클릭 액션(질문 전송)은 막기
    if (longPressTriggeredRef.current) {
      return;
    }

    // 짧게 탭한 경우 → 기존처럼 FAQ 전송
    sendFromFAQ(faqText);
  };

  // 🔥 드래그/취소 등으로 길게 누르기 중단
  const handleFaqPressCancel = () => {
    if (longPressTimeoutRef.current) {
      clearTimeout(longPressTimeoutRef.current);
      longPressTimeoutRef.current = null;
    }
    longPressTriggeredRef.current = false;
  };

  // ===== 사이드 메뉴 =====
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  // ===== 마법 구슬 =====
  const orbOptions = [
    {
      id: 'default',
      name: 'Default',
      description: 'Original magic orb',
      videoSrc: {
        mp4: 'https://res.cloudinary.com/dpuw0gcaf/video/upload/v1748854350/LumeeMagicOrb_Safari_rdmthi.mov',
        webm: 'https://res.cloudinary.com/dpuw0gcaf/video/upload/v1748852283/LumeeMagicOrb_WEBM_tfqoa4.webm',
      },
    },
    {
      id: 'dust',
      name: 'Fine Dust',
      description: 'Fine dust-reactive magic orb',
      videoSrc: {
        mp4: 'https://res.cloudinary.com/dpuw0gcaf/video/upload/v1749988390/finedustLumee_Safari_tkyral.mov',
        webm: 'https://res.cloudinary.com/dpuw0gcaf/video/upload/v1749988390/finedustLumee_Chrome_filwol.webm',
      },
    },
    {
      id: 'rain',
      name: 'Rain',
      description: 'Rain-reactive magic orb',
      videoSrc: {
        mp4: 'https://res.cloudinary.com/dpuw0gcaf/video/upload/v1749984449/rainLumee_Safari_iyfm0v.mov',
        webm: 'https://res.cloudinary.com/dpuw0gcaf/video/upload/v1749984445/rainLumee_WEBM_xblf7o.webm',
      },
    },
  ];

  const [selectedOrb, setSelectedOrb] = useState(() => {
    try {
      const savedOrb = localStorage.getItem('lumeeSelectedOrb');
      return savedOrb || 'default';
    } catch (error) {
      console.error('구슬 설정 로드 실패:', error);
      return 'default';
    }
  });

  const getCurrentOrb = () =>
    orbOptions.find((orb) => orb.id === selectedOrb) || orbOptions[0];

  const currentOrb = getCurrentOrb();

  // ===== 사이드 메뉴/구슬 함수 =====
  const toggleMenu = () => {
    setIsMenuOpen((v) => !v);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const selectOrb = (orbId) => {
    setSelectedOrb(orbId);
    closeMenu();
  };

  // ===== 슬라이더 (홈 / 캘린더) =====
  const [activePage, setActivePage] = useState(0);
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const THRESHOLD = 100;

  const handleTouchStart = (e) => {
    setTouchStartX(e.touches[0].clientX);
    setTouchEndX(null);
  };

  const handleTouchMove = (e) => {
    setTouchEndX(e.touches[0].clientX);
  };

  const finishSwipe = () => {
    if (touchStartX === null || touchEndX === null) return;
    const diff = touchStartX - touchEndX;

    if (diff > THRESHOLD && activePage < 1) {
      setActivePage(1);
    } else if (diff < -THRESHOLD && activePage > 0) {
      setActivePage(0);
    }

    setTouchStartX(null);
    setTouchEndX(null);
    setIsDragging(false);
  };

  const handleTouchEnd = () => {
    finishSwipe();
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setTouchStartX(e.clientX);
    setTouchEndX(null);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setTouchEndX(e.clientX);
  };

  const handleMouseUp = () => {
    if (!isDragging) return;
    finishSwipe();
  };

  // ===== useEffect – 로컬 스토리지 =====
  useEffect(() => {
    try {
      localStorage.setItem('lumeeFaqItems', JSON.stringify(faqItems));
    } catch (error) {
      console.error('FAQ 데이터 저장 실패:', error);
    }
  }, [faqItems]);

  useEffect(() => {
    try {
      localStorage.setItem('lumeeSelectedOrb', selectedOrb);
    } catch (error) {
      console.error('구슬 설정 저장 실패:', error);
    }
  }, [selectedOrb]);

  // ===== FAQ 저장/취소 =====
  const saveEdit = () => {
    if (editText.trim() === '') {
      alert('FAQ 내용을 입력해주세요!');
      return;
    }

    const newFaqItems = [...faqItems];
    newFaqItems[editingIndex] = editText.trim();
    setFaqItems(newFaqItems);
    setEditingIndex(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingIndex(null);
    setEditText('');
  };

  // ===== 날짜별 일정 찾기 =====
  // Google Calendar와 정적 schedules를 병합
  const allSchedules = [...calendarEvents, ...schedules];

  const selectedSchedule =
    selectedDate &&
    allSchedules.find((s) => {
      // date 필드가 없으면 건너뛰기
      if (!s.date) return false;

      const [y, m, d] = s.date.split('-').map(Number);
      const scheduleDate = new Date(y, m - 1, d);
      return isSameDay(scheduleDate, selectedDate);
    });

  // ===== 렌더링 =====
  return (
    <div className="app-container">
      {/* 사이드 메뉴 */}
      {isMenuOpen && (
        <div className="menu-overlay" onClick={closeMenu}>
          <div className="side-menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h3>
                Orb Selection <span className="beta-badge">BETA</span>
              </h3>
              <button className="menu-close-btn" onClick={closeMenu}>
                <img
                  src={`${process.env.PUBLIC_URL}/assets/icons/close.svg`}
                  alt="닫기"
                  className="close-icon"
                />
              </button>
            </div>

            <div className="orb-options">
              {orbOptions.map((orb) => (
                <div
                  key={orb.id}
                  className={`orb-option ${selectedOrb === orb.id ? 'selected' : ''
                    }`}
                  onClick={() => selectOrb(orb.id)}
                >
                  <div className="orb-preview">
                    <video
                      className="orb-preview-video"
                      autoPlay
                      loop
                      muted
                      playsInline
                    >
                      <source
                        src={orb.videoSrc.mp4}
                        type='video/mp4; codecs="hvc1"'
                      />
                      <source src={orb.videoSrc.webm} type="video/webm" />
                    </video>
                  </div>
                  <div className="orb-info">
                    <h4>{orb.name}</h4>
                    <p>{orb.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="menu-footer">
              <p className="beta-notice">
                This is a BETA feature. Auto-reactive orbs & more styles coming
                soon!
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 🔥 공통 헤더 – 홈 / 캘린더 둘 다에 보이게 */}
      <header className="weather-header">
        <button
          className="header-menu-btn"
          onClick={toggleMenu}
          aria-label="메뉴"
        >
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/menu.svg`}
            alt="메뉴"
            className="menu-icon"
          />
        </button>

        {/* ✅ 홈 화면(activePage === 0)에서만 위치/주소 표시 */}
        {activePage === 0 && (
          <button className="header-location" aria-label="위치 새로고침">
            <img
              src={`${process.env.PUBLIC_URL}/assets/icons/location.svg`}
              alt="위치"
              className="header-location-icon"
            />
            <span className="header-location-name">{location}</span>
          </button>
        )}

        {/* 프로필 버튼에 핸들러 연결 */}
        <button
          className="header-profile"
          aria-label={user ? "로그아웃" : "Google 로그인"}
          onClick={handleProfileClick}
        >
          <img
            src={currentUser.image}
            alt="프로필"
            className="profile-icon"
            style={{ borderRadius: '50%' }} // 구글 프로필 이미지를 위해 원형 처리
          />
        </button>
      </header>

      {/* 메인 슬라이더 */}
      <div
        className="home-slider"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="home-slider-inner"
          style={{ transform: `translateX(-${activePage * 50}%)` }}
        >
          {/* Page 0: 홈 */}
          <div className="home-page home-page-main">
            <div className="home-weather-info">
              <p className="date">{formattedDate}</p>
              <p className="temperature">
                {weather ? `${weather.temp}°` : `00°C`}
              </p>
              <div className="description">
                <WeatherDescriptionWithIcon weather={weather} />
              </div>
              <p className="sub-summary">
                {weather
                  ? `Feels like ${weather.feelsLike}° | H: ${weather.tempMax}° L: ${weather.tempMin}°`
                  : 'Loading...'}
              </p>
            </div>

            <div className="background-media">
              <video
                className="lumee-magic-orb"
                autoPlay
                loop
                muted
                playsInline
                key={selectedOrb}
                controls={false}
              >
                <source
                  src={currentOrb.videoSrc.mp4}
                  type='video/mp4; codecs="hvc1"'
                />
                <source src={currentOrb.videoSrc.webm} type="video/webm" />
              </video>
            </div>

            <div className="user-greeting-section">
              <div className="greeting">{currentUser.greeting}</div>
              <h1 className="main-question">
                What weather info do you need?
              </h1>
            </div>

            <div className="faq-section">
              <div className="FAQ-buttons">
                {faqItems.map((faqText, index) => (
                  <div key={index} className="FAQ-card">
                    {editingIndex === index ? (
                      <div className="FAQ-edit-mode">
                        <textarea
                          className="FAQ-edit-input"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          autoFocus
                        />
                        <div className="FAQ-edit-buttons">
                          <button
                            className="FAQ-save-btn"
                            onClick={saveEdit}
                          >
                            Save
                          </button>
                          <button
                            className="FAQ-cancel-btn"
                            onClick={cancelEdit}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <button
                          className="FAQ-button"
                          // 👉 길게 누르면 수정, 짧게 누르면 질문 전송
                          onMouseDown={() => handleFaqPressStart(index)}
                          onMouseUp={() => handleFaqPressEnd(faqText)}
                          onMouseLeave={handleFaqPressCancel}
                          onTouchStart={() => handleFaqPressStart(index)}
                          onTouchEnd={() => handleFaqPressEnd(faqText)}
                          onTouchMove={handleFaqPressCancel}
                        >
                          <span className="FAQ-button-text">
                            {faqText}
                          </span>
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Page 1: 캘린더 */}
          <div className="home-page home-page-calendar">
            {/* 🔥 이름 Pill 제거 (원하면 다시 추가 가능) */}
            {/* <div className="calendar-name-pill">{currentUser.name}</div> */}

            {/* 월/연도 */}
            <p className="calendar-month">
              {formatMonthYear(selectedDate || calendarBaseDate)}
            </p>

            {/* 날짜 버튼 줄 */}
            <div className="calendar-week-row">
              {weekDates.map((d) => {
                const selected = isSameDay(d, selectedDate);
                return (
                  <button
                    key={d.toISOString()}
                    className={`calendar-day${selected ? ' selected' : ''}`}
                    onClick={() => setSelectedDate(d)}
                  >
                    <span className="calendar-day-date">{d.getDate()}</span>
                    <span className="calendar-day-weekday">
                      {weekdayShort[d.getDay()]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* 날짜 선택 상태에 따라 텍스트 변경 */}
            <p className="calendar-cta">
              {selectedDate ? 'Today' : 'Choose the day'}
            </p>

            {/* 👉 일정 카드 / + 카드 영역 */}
            <div className="calendar-plan-wrapper">
              {!user ? (
                <div className="plan-card-empty-text">
                  Please sign in to see your Google Calendar events.
                </div>
              ) : isLoadingCalendar ? (
                <div className="plan-card-empty-text">
                  Loading calendar events...
                </div>
              ) : selectedDate ? (
                selectedSchedule ? (
                  <PlanCard schedule={selectedSchedule} />
                ) : (
                  <div className="plan-card-empty-text">
                    No schedule for this day.
                  </div>
                )
              ) : null}
            </div>
          </div>
        </div>

        <div className="home-page-indicator">
          <span
            className={`indicator-dot ${activePage === 0 ? 'active' : ''
              }`}
          />
          <span
            className={`indicator-dot ${activePage === 1 ? 'active' : ''
              }`}
          />
        </div>
      </div>

      {/* 하단 입력창 */}
      <div className="footer-input">
        <div className="input-wrapper">
          <button className="plus-button" onClick={onCameraClick}>
            <img
              src={`${process.env.PUBLIC_URL}/assets/icons/Camera.svg`}
              alt="카메라연결"
            />
          </button>
          <input
            type="text"
            placeholder="Ask Lumee about the weather..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          />
          <button className="mic-button" onClick={handleVoiceInput}>
            <img
              src={`${process.env.PUBLIC_URL}/assets/icons/microphone.svg`}
              alt="음성입력"
            />
          </button>
        </div>
        <button className="send-button" onClick={handleSend}>
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/send.svg`}
            alt="전송"
          />
        </button>
      </div>
    </div>
  );
};

export default Home;