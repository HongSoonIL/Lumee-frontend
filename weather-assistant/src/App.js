import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import Home from './screens/Home/Home';
import Chat from './screens/Chat/Chat';
import VoiceInput from './screens/VoiceInput/VoiceInput';
import KnockDetector from './screens/VoiceInput/KnockDetector';
// 1. 경로를 'screens' (복수형) 및 'camera' (소문자)로 수정합니다.
import CameraScreen from './screens/camera/CameraScreen';
import WelcomeScreen from './screens/welcome/WelcomeScreen';

function App() {
  const [view, setView] = useState('welcome');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('Fetching location...');
  const [coords, setCoords] = useState(null);
  const [weather, setWeather] = useState(null);
  // const [uid, setUid] = useState('user01');
  // 1. UID를 state로 관리하도록 변경
  const [uid, setUid] = useState('testUser1'); // 기본값을 testUser1로 설정

  // 진행 중인 요청을 추적하기 위한 ref
  const abortControllerRef = useRef(null);
  const thinkingTimerRef = useRef(null);

  // 현재 화면을 추적하기 위한 state 추가 (App.js 상단에)
  const [previousView, setPreviousView] = useState('home');

  const [currentScreen, setCurrentScreen] = useState('home'); // 'home', 'chat', 'camera'

  useEffect(() => {
    const now = new Date();
    const h = now.getHours().toString().padStart(2, '0');
    const m = now.getMinutes().toString().padStart(2, '0');
    setTime(`${h}:${m}`);

    // 위치 정보 가져오기 및 주소 변환
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setCoords({ latitude, longitude });

        try {
          const res = await fetch('http://localhost:4000/reverse-geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude })
          });
          const data = await res.json();
          setLocation(data.region || '주소를 찾을 수 없음');
        } catch (err) {
          console.error('📍 주소 요청 실패:', err);
          setLocation('주소 요청 실패');
        }

        try {
          const res = await fetch('http://localhost:4000/weather', { //http로 변경
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ latitude, longitude })
          });
          const data = await res.json();
          setWeather(data);
        } catch (err) {
          console.error('🌧️날씨 정보 오류:', err);
        }
      },
      () => {
        setLocation('위치 정보 접근 거부됨');
      }
    );
  }, []);

  // 뒤로가기 함수 - 진행 중인 요청 취소 및 완전한 상태 초기화
  const handleBackToHome = () => {
    console.log('🔙 뒤로가기 시작 - 모든 상태 초기화');
    // 1. 진행 중인 HTTP 요청 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      console.log('⏹️ HTTP 요청 취소됨');
    }
    // 2. 진행 중인 타이머 취소
    if (thinkingTimerRef.current) {
      clearTimeout(thinkingTimerRef.current);
      thinkingTimerRef.current = null;
      console.log('⏰ Thinking 타이머 취소됨');
    }
    // 3. 상태 즉시 초기화 (동기적으로)
    setView('home');
    setMessages([]);
    setInput('');
    console.log('✅ 모든 상태 초기화 완료');
  };

  // ✨ API 호출 함수 (새로운 백엔드 아키텍처에 맞게 대폭 수정됨) ✨
  // ==================================================================
  const callGeminiAPI = async (messageText) => {
    // 이전 요청이 있다면 취소
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    // "Thinking..." 메시지 표시 로직
    let thinkingShown = false;
    thinkingTimerRef.current = setTimeout(() => {
      if (signal.aborted) return;
      setMessages(prev => [...prev, { type: 'bot', text: 'Thinking', isThinking: true }]);
      thinkingShown = true;
    }, 800);

    try {
      // ✅ 엔드포인트를 /chat으로 변경하고, uid를 함께 전송합니다.
      const res = await fetch('http://localhost:4000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userInput: messageText, location, coords, uid: uid }), //🔥 하드코딩된 값 대신 state 사용
        signal // AbortController 신호 추가
      });

      // API 응답이 빨리 오면 Thinking 타이머 취소
      clearTimeout(thinkingTimerRef.current);

      if (signal.aborted) return;

      const data = await res.json();

      // "Thinking" 메시지를 실제 응답으로 교체
      setMessages(prev => {
        const newMessages = [...prev];
        // Thinking 메시지가 있다면 제거
        if (thinkingShown && newMessages[newMessages.length - 1]?.isThinking) {
          newMessages.pop();
        }
        // 백엔드에서 받은 데이터로 새 메시지 추가
        return [
          ...newMessages,
          {
            type: 'bot',
            text: data.reply || '응답을 이해하지 못했어요.',
            graph: data.graph || null,
            graphDate: data.graphDate || null,
            dust: data.dust || null,
            videoUrl: data.videoUrl || null  // 🎬 여기에 추가!
          }
        ];
      });


    } catch (error) {
      if (error.name === 'AbortError') {
        console.log('🚫 요청이 사용자에 의해 취소되었습니다.');
        return;
      }
      // 그 외 네트워크 오류 등 처리
      clearTimeout(thinkingTimerRef.current);
      setMessages(prev => {
        const newMessages = [...prev].filter(m => !m.isThinking);
        return [...newMessages, { type: 'bot', text: `❌ 오류가 발생했어요: ${error.message}` }];
      });
    } finally {
      abortControllerRef.current = null;
    }
  };

  // 통합된 메시지 전송 함수
  const sendMessage = async (messageText, fromInput = false) => {
    const userMsg = { type: 'user', text: messageText };
    setMessages(prev => [...prev, userMsg]);

    if (fromInput) {
      setInput('');
    }

    setView('chat');
    await callGeminiAPI(messageText);
  };

  const handleSend = async () => {
    if (!input.trim()) return;
    await sendMessage(input, true);
  };

  const sendFromFAQ = async (text) => {
    await sendMessage(text, false);
  };

  const handleVoiceInput = () => { // 음성인식 화면으로 전환하는 함수
    setPreviousView(view); // 현재 화면을 이전 화면으로 저장
    setView('listening');
  };

  // KnockDetector가 호출할 onKnock 함수를 정의합니다.
  // 이 함수가 바로 음성인식을 켜는 역할을 합니다.
  const onKnock = () => {
    console.log('App.js: 노크 신호를 받아 음성인식을 시작합니다.');
    handleVoiceInput();
  };


  // 기존 useEffect들 아래에 이 코드를 추가하세요

  // 메시지가 업데이트될 때마다 스크롤을 맨 아래로
  useEffect(() => {
    const messagesContainer = document.querySelector('.messages');
    if (messagesContainer && messages.length > 0) {
      // 부드러운 스크롤로 맨 아래로 이동
      messagesContainer.scrollTo({
        top: messagesContainer.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages]); // messages 배열이 변경될 때마다 실행

  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (thinkingTimerRef.current) {
        clearTimeout(thinkingTimerRef.current);
      }
    };
  }, []);

  return (
    <div className={`app ${view}`}>
      <KnockDetector onKnock={onKnock} />
      {view === 'welcome' && (
        <WelcomeScreen setView={setView} setUid={setUid} />
      )}
      {view === 'home' && (
        <Home
          time={time}
          location={location}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          sendFromFAQ={sendFromFAQ}
          handleVoiceInput={handleVoiceInput}
          weather={weather}
          uid={uid}
          setUid={setUid}
          setView={setView} // 2. setView prop 전달
        />
      )}
      {view === 'chat' && (
        <Chat
          messages={messages}
          input={input}
          setInput={setInput}
          handleSend={handleSend}
          onBackToHome={handleBackToHome}
          handleVoiceInput={handleVoiceInput}
          onCameraClick={() => setView('camera')}
        />
      )}


      {view === 'listening' && (
        <VoiceInput
          setView={setView}
          previousView={previousView} // 이전 화면 정보 전달
          onResult={async (text) => {
            console.log('🎤 음성 결과 받음:', text);

            // 즉시 메시지 전송 (지연 없음)
            try {
              await sendMessage(text, false);
            } catch (error) {
              console.error('메시지 전송 실패:', error);
            }
          }}
        />
      )}

      {/* 3. 'camera' 뷰 렌더링 로직 추가 */}
      {view === 'camera' && (
        <CameraScreen
          onBack={() => setView('chat')} // 채팅에서 카메라로 왔으므로 채팅으로 돌아감
          uid={uid}
        />
      )}
    </div>



  );
}

export default App;