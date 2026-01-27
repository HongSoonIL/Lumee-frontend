// src/screens/Home/Home.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Home.css';
import { WeatherDescriptionWithIcon } from './weatherIconUtils';

// Firebase 로그인 함수 import
import { signInWithGoogle, logout } from '../../firebase';

// ===== 날짜 유틸 =====
function formatDate(date) {
  const options = { month: 'short', day: 'numeric', weekday: 'long' };
  const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(date);

  const month = parts.find((p) => p.type === 'month').value;
  const day = parts.find((p) => p.type === 'day').value;
  const weekday = parts.find((p) => p.type === 'weekday').value;

  return `${month} ${day}, ${weekday}`;
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
  calendarEvents,
  setCalendarEvents
}) => {
  // 환경 변수에서 백엔드 URL 가져오기
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

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
  // 캘린더 데이터는 백그라운드에서 가져와 백엔드에 전달합니다.
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  // ✨ 백엔드로부터 Google Calendar 일정 가져오기
  const fetchCalendarEvents = useCallback(async () => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      console.log('❌ Access token not found');
      return;
    }

    setIsLoadingCalendar(true);
    try {
      const response = await fetch(`${BACKEND_URL}/calendar/events`, {
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

        // 시간 정보 추출 및 포맷팅
        let timeRange = 'All day';
        if (event.start && event.start.includes('T')) {
          // 시작 시간 파싱
          const startTime = new Date(event.start);
          const startHour = startTime.getHours();
          const startMin = startTime.getMinutes().toString().padStart(2, '0');
          const startPeriod = startHour >= 12 ? 'PM' : 'AM';
          const startHour12 = startHour % 12 || 12;

          // 종료 시간이 있으면 파싱
          if (event.end && event.end.includes('T')) {
            const endTime = new Date(event.end);
            const endHour = endTime.getHours();
            const endMin = endTime.getMinutes().toString().padStart(2, '0');
            const endPeriod = endHour >= 12 ? 'PM' : 'AM';
            const endHour12 = endHour % 12 || 12;

            timeRange = `${startHour12}:${startMin} ${startPeriod} - ${endHour12}:${endMin} ${endPeriod}`;
          } else {
            timeRange = `${startHour12}:${startMin} ${startPeriod}`;
          }
        }

        const formatted = {
          ...event,
          date: eventDate, // YYYY-MM-DD 형식 보장
          title: event.title || event.summary || 'Untitled Event',
          tag: event.tag || 'Event',
          subtitle: event.location ? `📍 ${event.location}` : (event.subtitle || '#Calendar'),
          timeRange: event.timeRange || timeRange, // 추출한 시간 사용
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
  }, [BACKEND_URL, setCalendarEvents]);

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
  }, [user, fetchCalendarEvents]); // user와 fetchCalendarEvents가 변경될 때마다 실행

  // ===== 날짜 =====
  const today = new Date();
  const formattedDate = formatDate(today);

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

  // ===== 사용자 선호도 (Sensitivity & Daily Routine) =====
  const [userPreferences, setUserPreferences] = useState(() => {
    try {
      const savedPrefs = localStorage.getItem('lumeeUserPreferences');

      // 기본값 정의
      const defaultPrefs = {
        sensitivity: {
          cold: 50,         // 0-100: 0=강철체력, 100=매우추위탐
          heat: 50,         // 0-100: 0=사막가능, 100=녹아내림
          fineDust: 50,     // 0-100: 0=신경안씀, 100=매우예민
          rain: 50          // 0-100: 0=비좋아함, 100=매우싫음
        },
        routine: {
          transport: 'walk',    // 'walk' | 'drive'
          style: 'casual',      // 'formal' | 'casual'
          activeTime: 'morning' // 'morning' | 'night'
        },
        health: {
          exerciseFrequency: 50,  // 0-100: 0=거의 안 함, 100=매일 운동
          allergyInfo: '',        // 알레르기 정보 (텍스트)
          healthInfo: ''          // 건강 정보 (텍스트)
        }
      };

      if (savedPrefs) {
        const parsed = JSON.parse(savedPrefs);
        // 기존 데이터와 새로운 구조를 병합 (기존 데이터 우선)
        return {
          sensitivity: { ...defaultPrefs.sensitivity, ...parsed.sensitivity },
          routine: { ...defaultPrefs.routine, ...parsed.routine },
          health: { ...defaultPrefs.health, ...parsed.health } // health가 없으면 기본값 사용
        };
      }

      return defaultPrefs;
    } catch (error) {
      console.error('사용자 선호도 로드 실패:', error);
      return {
        sensitivity: { cold: 50, heat: 50, fineDust: 50, rain: 50 },
        routine: { transport: 'walk', style: 'casual', activeTime: 'morning' },
        health: { exerciseFrequency: 50, allergyInfo: '', healthInfo: '' }
      };
    }
  });

  // 슬라이더 값 변경 핸들러
  const handleSensitivityChange = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      sensitivity: {
        ...prev.sensitivity,
        [key]: parseInt(value)
      }
    }));
  };

  // 토글 값 변경 핸들러
  const handleRoutineChange = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      routine: {
        ...prev.routine,
        [key]: value
      }
    }));
  };

  // 건강 정보 슬라이더 변경 핸들러
  const handleHealthSliderChange = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      health: {
        ...prev.health,
        [key]: parseInt(value)
      }
    }));
  };

  // 건강 정보 텍스트 입력 핸들러
  const handleHealthTextChange = (key, value) => {
    setUserPreferences(prev => ({
      ...prev,
      health: {
        ...prev.health,
        [key]: value
      }
    }));
  };

  // ===== 사이드 메뉴 함수 =====
  const toggleMenu = () => {
    setIsMenuOpen((v) => !v);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
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
      localStorage.setItem('lumeeUserPreferences', JSON.stringify(userPreferences));
    } catch (error) {
      console.error('사용자 선호도 저장 실패:', error);
    }
  }, [userPreferences]);

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

  // ===== 렌더링 =====
  return (
    <div className="app-container">
      {/* 사이드 메뉴 */}
      {isMenuOpen && (
        <div className="menu-overlay" onClick={closeMenu}>
          <div className="side-menu" onClick={(e) => e.stopPropagation()}>
            <div className="menu-header">
              <h3>
                Settings <span className="beta-badge">BETA</span>
              </h3>
              <button className="menu-close-btn" onClick={closeMenu}>
                <img
                  src={`${process.env.PUBLIC_URL}/assets/icons/close.svg`}
                  alt="닫기"
                  className="close-icon"
                />
              </button>
            </div>

            {/* ===== User Preferences Section ===== */}
            <div className="user-preferences-section">
              <h4 className="preferences-section-title">🎚️ Weather Sensitivity</h4>

              {/* Cold Sensitivity Slider */}
              <div className="sensitivity-slider-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">🌡️</span>
                  <span className="slider-label">추위 타는 정도</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userPreferences.sensitivity.cold}
                  onChange={(e) => handleSensitivityChange('cold', e.target.value)}
                  className="custom-range-slider"
                />
                <div className="slider-labels">
                  <span>강철 체력</span>
                  <span>추워요</span>
                </div>
              </div>

              {/* Heat Sensitivity Slider */}
              <div className="sensitivity-slider-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">🌡️</span>
                  <span className="slider-label">더위 타는 정도</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userPreferences.sensitivity.heat}
                  onChange={(e) => handleSensitivityChange('heat', e.target.value)}
                  className="custom-range-slider"
                />
                <div className="slider-labels">
                  <span>사막 가능</span>
                  <span>더워요</span>
                </div>
              </div>

              {/* Fine Dust Sensitivity Slider */}
              <div className="sensitivity-slider-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">🤧</span>
                  <span className="slider-label">미세먼지 민감도</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userPreferences.sensitivity.fineDust}
                  onChange={(e) => handleSensitivityChange('fineDust', e.target.value)}
                  className="custom-range-slider"
                />
                <div className="slider-labels">
                  <span>신경 안 씀</span>
                  <span>매우 예민</span>
                </div>
              </div>

              {/* Rain Sensitivity Slider */}
              <div className="sensitivity-slider-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">💧</span>
                  <span className="slider-label">비/습도 불쾌도</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userPreferences.sensitivity.rain}
                  onChange={(e) => handleSensitivityChange('rain', e.target.value)}
                  className="custom-range-slider"
                />
                <div className="slider-labels">
                  <span>비 좋아함</span>
                  <span>매우 싫음</span>
                </div>
              </div>

              <h4 className="preferences-section-title" style={{ marginTop: '24px' }}>🎯 Daily Routine</h4>

              {/* Transport Toggle */}
              <div className="routine-toggle-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">🚌</span>
                  <span className="slider-label">주요 이동 수단</span>
                </div>
                <div className="toggle-switch">
                  <button
                    className={`toggle-option ${userPreferences.routine.transport === 'walk' ? 'active' : ''}`}
                    onClick={() => handleRoutineChange('transport', 'walk')}
                  >
                    대중교통
                  </button>
                  <button
                    className={`toggle-option ${userPreferences.routine.transport === 'drive' ? 'active' : ''}`}
                    onClick={() => handleRoutineChange('transport', 'drive')}
                  >
                    자차
                  </button>
                </div>
              </div>

              {/* Style Toggle */}
              <div className="routine-toggle-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">👕</span>
                  <span className="slider-label">옷차림 무드</span>
                </div>
                <div className="toggle-switch">
                  <button
                    className={`toggle-option ${userPreferences.routine.style === 'formal' ? 'active' : ''}`}
                    onClick={() => handleRoutineChange('style', 'formal')}
                  >
                    포멀
                  </button>
                  <button
                    className={`toggle-option ${userPreferences.routine.style === 'casual' ? 'active' : ''}`}
                    onClick={() => handleRoutineChange('style', 'casual')}
                  >
                    캐주얼
                  </button>
                </div>
              </div>

              {/* Active Time Toggle */}
              <div className="routine-toggle-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">🕒</span>
                  <span className="slider-label">주 활동 시간</span>
                </div>
                <div className="toggle-switch">
                  <button
                    className={`toggle-option ${userPreferences.routine.activeTime === 'morning' ? 'active' : ''}`}
                    onClick={() => handleRoutineChange('activeTime', 'morning')}
                  >
                    아침형
                  </button>
                  <button
                    className={`toggle-option ${userPreferences.routine.activeTime === 'night' ? 'active' : ''}`}
                    onClick={() => handleRoutineChange('activeTime', 'night')}
                  >
                    올빼미형
                  </button>
                </div>
              </div>

              <h4 className="preferences-section-title" style={{ marginTop: '24px' }}>🏃 Activity & Health</h4>

              {/* Exercise Frequency Slider */}
              <div className="sensitivity-slider-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">💪</span>
                  <span className="slider-label">운동 빈도</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={userPreferences.health.exerciseFrequency}
                  onChange={(e) => handleHealthSliderChange('exerciseFrequency', e.target.value)}
                  className="custom-range-slider"
                />
                <div className="slider-labels">
                  <span>거의 안 함</span>
                  <span>매일 운동</span>
                </div>
              </div>

              {/* Allergy Info Text Input */}
              <div className="health-text-input-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">🌸</span>
                  <span className="slider-label">알레르기 정보</span>
                </div>
                <textarea
                  className="health-text-input"
                  placeholder="꽃가루, 특정 음식 등 알레르기 정보를 입력하세요..."
                  value={userPreferences.health.allergyInfo}
                  onChange={(e) => handleHealthTextChange('allergyInfo', e.target.value)}
                  rows="3"
                />
              </div>

              {/* Health Info Text Input */}
              <div className="health-text-input-wrapper">
                <div className="slider-header">
                  <span className="slider-emoji">💊</span>
                  <span className="slider-label">건강 정보</span>
                </div>
                <textarea
                  className="health-text-input"
                  placeholder="천식, 편두통 등 날씨에 영향받는 건강 상태를 입력하세요..."
                  value={userPreferences.health.healthInfo}
                  onChange={(e) => handleHealthTextChange('healthInfo', e.target.value)}
                  rows="3"
                />
              </div>
            </div>
          </div>
        </div>
      )}


      {/* 헤더 */}
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

        {/* 위치/주소 표시 */}
        <button className="header-location" aria-label="위치 새로고침">
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/location.svg`}
            alt="위치"
            className="header-location-icon"
          />
          <span className="header-location-name">{location}</span>
        </button>

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

      {/* 메인 홈 화면 */}
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
            controls={false}
          >
            <source
              src="https://res.cloudinary.com/dpuw0gcaf/video/upload/v1748854350/LumeeMagicOrb_Safari_rdmthi.mov"
              type='video/mp4; codecs="hvc1"'
            />
            <source src="https://res.cloudinary.com/dpuw0gcaf/video/upload/v1748852283/LumeeMagicOrb_WEBM_tfqoa4.webm" type="video/webm" />
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
