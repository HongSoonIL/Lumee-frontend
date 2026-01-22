// src/screens/Home/Home.js

import React, { useState, useEffect, useRef, useCallback } from 'react';
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

// ✨ 오늘부터 7일간의 날짜를 보여주는 함수
function getWeekDates(baseDate) {
  const d = new Date(baseDate);
  const arr = [];

  for (let i = 0; i < 7; i++) {
    const nextDate = new Date(d);
    nextDate.setDate(d.getDate() + i);
    arr.push(nextDate);
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
  const [isLoadingCalendar, setIsLoadingCalendar] = useState(false);

  const [showEventForm, setShowEventForm] = useState(false); // 입력창 열림/닫힘 상태
  const [newEvent, setNewEvent] = useState({
    summary: '',
    location: '',
    description: '',
    startTime: '', // 빈 값으로 시작 (필수 선택 유도)
    endTime: ''
  });

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

  // ✨ 백엔드에 일정 추가 요청 보내기
  const addCalendarEvent = async () => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) {
      alert("Please sign in first.");
      return;
    }

    // 유효성 검사 (시간을 선택 안 했으면 중단)
    if (!newEvent.summary || !newEvent.startTime || !newEvent.endTime) {
      alert("Please enter a title and select both start and end times! ⏰");
      return;
    }

    // ---- [추가] 시간 파싱 & duration 계산 (자정 넘어가는 일정 포함) ----
    const [sh, sm] = newEvent.startTime.split(':').map(Number);
    const [eh, em] = newEvent.endTime.split(':').map(Number);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    // 자정 넘어가는 경우: 다음날로 가정해서 duration 계산
    let durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) {
      durationMinutes += 24 * 60;
    }

    // 최대 23.5시간(1410분) 제한
    const MAX_MINUTES = 23 * 60 + 30; // 1410
    if (durationMinutes > MAX_MINUTES) {
      alert("Event duration can't exceed 23.5 hours.");
      return;
    }

    // 날짜와 시간 합치기 (자정 넘어가면 endDate는 다음날)
    const dateStr = selectedDate.toISOString().split('T')[0];

    const endDateObj = new Date(selectedDate);
    if (endMinutes <= startMinutes) {
      endDateObj.setDate(endDateObj.getDate() + 1);
    }
    const endDateStr = endDateObj.toISOString().split('T')[0];

    const startISO = `${dateStr}T${newEvent.startTime}:00+09:00`;
    const endISO = `${endDateStr}T${newEvent.endTime}:00+09:00`;

    try {
      const response = await fetch(`${BACKEND_URL}/calendar/events/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          summary: newEvent.summary,
          location: newEvent.location,
          description: newEvent.description,
          startDateTime: startISO,
          endDateTime: endISO,
        }),
      });

      if (response.ok) {
        alert("Event added successfully! 🎉");
        setShowEventForm(false); // 폼 닫기
        setNewEvent({ summary: '', location: '', description: '', startTime: '', endTime: '' }); // 초기화
        fetchCalendarEvents(); // 목록 새로고침
      } else {
        alert("Failed to add event.");
      }
    } catch (error) {
      console.error("Add Event Error:", error);
    }
  };

  // 일정 삭제
  const deleteCalendarEvent = async (eventId) => {
    if (!window.confirm("이 일정을 삭제하시겠습니까?")) return;

    const token = localStorage.getItem('googleAccessToken');
    try {
      const response = await fetch(`${BACKEND_URL}/calendar/events/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          eventId: eventId
        }),
      });

      if (response.ok) {
        alert("일정이 삭제되었습니다.");
        fetchCalendarEvents(); // 목록 새로고침
        // setSelectedDate(null); // 선택 초기화

      }
    } catch (error) {
      console.error("삭제 에러:", error);
    }
  };

  // ✨ 백엔드에 일정 수정 요청 보내기
  const updateCalendarEvent = async (eventId, updatedData) => {
    const token = localStorage.getItem('googleAccessToken');
    if (!token) return;

    try {
      const response = await fetch(`${BACKEND_URL}/calendar/events/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: token,
          eventId: eventId,
          // updatedData에는 summary, location, description 등이 들어옵니다.
          ...updatedData,
        }),
      });

      if (response.ok) {
        alert("Event updated! ✨");
        fetchCalendarEvents(); // 목록 새로고침
      } else {
        alert("Failed to update event.");
      }
    } catch (error) {
      console.error("Update Error:", error);
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
  }, [user, fetchCalendarEvents]); // user와 fetchCalendarEvents가 변경될 때마다 실행

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

  // ===== 사용자 선호도 (Sensitivity & Daily Routine) =====
  const [userPreferences, setUserPreferences] = useState(() => {
    try {
      const savedPrefs = localStorage.getItem('lumeeUserPreferences');
      return savedPrefs ? JSON.parse(savedPrefs) : {
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
        }
      };
    } catch (error) {
      console.error('사용자 선호도 로드 실패:', error);
      return {
        sensitivity: { cold: 50, heat: 50, fineDust: 50, rain: 50 },
        routine: { transport: 'walk', style: 'casual', activeTime: 'morning' }
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

  // ===== 사이드 메뉴 함수 =====
  const toggleMenu = () => {
    setIsMenuOpen((v) => !v);
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
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

  // ===== 날짜별 일정 찾기 =====
  // Google Calendar와 정적 schedules를 병합
  const allSchedules = [...calendarEvents, ...schedules];

  const selectedSchedules =
    selectedDate &&
    allSchedules.filter((s) => {
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
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedDate(d);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
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
                <div className="plan-list-container">

                  {/* 1. [상단 고정] 일정 추가 버튼 및 입력 폼 */}
                  <div className="event-add-section">
                    {!showEventForm ? (
                      <button className="add-event-btn" onClick={() => setShowEventForm(true)}>
                        + Add New Event
                      </button>
                    ) : (
                      <div className="event-input-form">
                        <input
                          type="text" placeholder="Title (Required)"
                          className="event-form-input"
                          value={newEvent.summary}
                          onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
                        />
                        <input
                          type="text" placeholder="Location"
                          className="event-form-input"
                          value={newEvent.location}
                          onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
                        />
                        <textarea
                          placeholder="Description"
                          className="event-form-textarea"
                          value={newEvent.description}
                          onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                        />
                        <div className="time-picker-row">
                          <input
                            type="time"
                            value={newEvent.startTime}
                            onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                          />
                          <input
                            type="time"
                            value={newEvent.endTime}
                            onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                          />
                        </div>
                        <div className="form-action-btns">
                          <button onClick={addCalendarEvent} className="save-btn">Save</button>
                          <button onClick={() => setShowEventForm(false)} className="cancel-btn">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. [하단 스크롤] 등록된 일정 리스트 */}
                  <div className="scrollable-plan-list">
                    {selectedSchedules && selectedSchedules.length > 0 ? (
                      selectedSchedules.map((schedule) => (
                        <div key={schedule.id || schedule.event_id} className="plan-item-group">
                          {/* onDelete 프롭스로 삭제 함수 전달 */}
                          <PlanCard
                            schedule={schedule}
                            onDelete={() => deleteCalendarEvent(schedule.id || schedule.event_id)}
                            onUpdate={updateCalendarEvent}
                          />
                        </div>
                      ))
                    ) : (
                      !showEventForm && <div className="plan-card-empty-text">No schedule for this day.</div>
                    )}
                  </div>
                </div>
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
