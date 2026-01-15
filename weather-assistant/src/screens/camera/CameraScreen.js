import React, { useState, useRef, useEffect } from 'react';
import './Camera_Before.css';
import './Camera_Cautions.css';
import './Camera.css';
import './Camera_Done.css';

// 브라우저 언어 감지 함수
const detectLanguage = () => {
  const browserLang = navigator.language || navigator.userLanguage;
  // "ko-KR" -> "ko", "en-US" -> "en"
  const lang = browserLang.toLowerCase().startsWith('ko') ? 'ko' : 'en';
  console.log(`🌐 감지된 언어: ${browserLang} -> ${lang}`);
  return lang;
};

const CameraScreen = ({ onBack, uid, user }) => {
  // 환경 변수에서 URL 가져오기
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:4000';

  // 상태 관리
  const [step, setStep] = useState('cautions'); // cautions -> before -> scanning -> done
  const [capturedImage, setCapturedImage] = useState(null);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [streamReady, setStreamReady] = useState(false);

  // 브라우저 카메라를 위한 video ref
  const videoRef = useRef(null);

  // 사용자 이름 설정 (실제 Google 계정 정보 사용)
  const userName = user?.displayName || 'User';

  // 브라우저 카메라 스트림 초기화 및 정리
  useEffect(() => {
    const startCamera = async () => {
      try {
        console.log('📷 브라우저 카메라 시작 중...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user', // 전면 카메라
            width: { ideal: 1280 },
            height: { ideal: 720 }
          }
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setStreamReady(true);
          console.log('✅ 카메라 스트림 연결됨');
        }
      } catch (err) {
        console.error('❌ 카메라 접근 오류:', err);
        if (err.name === 'NotAllowedError') {
          setError('카메라 접근 권한이 필요합니다');
        } else if (err.name === 'NotFoundError') {
          setError('카메라를 찾을 수 없습니다');
        } else {
          setError('카메라 접근에 실패했습니다');
        }
        setStreamReady(false);
      }
    };

    // 'before' 단계에서만 카메라 시작
    if (step === 'before') {
      startCamera();
    }

    // 클린업: 컴포넌트 언마운트 또는 단계 변경 시 스트림 정지
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const video = videoRef.current;
      if (video?.srcObject) {
        const tracks = video.srcObject.getTracks();
        tracks.forEach(track => {
          track.stop();
          console.log('🛑 카메라 트랙 정지됨');
        });
        video.srcObject = null;
        setStreamReady(false);
      }
    };
  }, [step]);

  // Canvas를 사용하여 video 프레임 캡처
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video || !streamReady) {
      throw new Error('카메라가 준비되지 않았습니다');
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');

    // 거울 모드 적용 (좌우 반전)
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0);

    // Base64 이미지로 변환 (JPEG, 90% 품질)
    return canvas.toDataURL('image/jpeg', 0.9);
  };

  // 촬영 처리 함수 (브라우저 카메라 사용)
  const handleCapture = async () => {
    setLoading(true);
    setStep('scanning');
    setError(null);

    try {
      console.log('📸 브라우저에서 사진 촬영 시작...');

      // 브라우저에서 직접 사진 캡처
      const imageDataUrl = capturePhoto();

      // Base64 헤더 제거
      const base64Image = imageDataUrl.replace(/^data:image\/jpeg;base64,/, '');
      console.log('📤 백엔드로 이미지 전송 중...');

      let latitude = null;
      let longitude = null;

      try {
        console.log('위치 정보 요청 중...');
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            timeout: 10000,  // 10초로 증가
            maximumAge: 60000,  // 1분간 캐시된 위치 사용 가능
            enableHighAccuracy: false  // WiFi 기반 위치 사용 (더 빠름)
          });
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;
        console.log(`✅ 위치 정보: ${latitude}, ${longitude}`);
      } catch (geoError) {
        console.warn('❌ 위치 정보를 가져올 수 없습니다.:', geoError.message);
      }


      // 백엔드에 이미지 분석 요청
      const response = await fetch(`${BACKEND_URL}/camera/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uid,
          image: base64Image,
          latitude,
          longitude,
          language: detectLanguage()  // 👈 언어 정보 추가
        })
      });

      if (!response.ok) {
        throw new Error(`분석 실패: ${response.status}`);
      }

      const data = await response.json();
      console.log('✅ 분석 응답:', data);

      // 캡처한 이미지와 분석 결과 저장
      setCapturedImage(imageDataUrl);
      setAnalysisResult(data.analysis);

      // 3초 후 완료 화면으로
      setTimeout(() => {
        setStep('done');
        setLoading(false);
      }, 3000);

    } catch (err) {
      console.error('❌ 촬영 오류:', err);
      setError(err.message);
      setStep('before');
      setLoading(false);

      // 3초 후 에러 메시지 자동 제거
      setTimeout(() => setError(null), 3000);
    }
  };

  // 재촬영
  const handleRetake = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    setError(null);
    setStep('before');
  };

  // 에러 표시 컴포넌트
  const ErrorToast = () => error ? (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(244, 67, 54, 0.95)',
      color: 'white',
      padding: '12px 24px',
      borderRadius: '20px',
      fontSize: '14px',
      fontWeight: '500',
      zIndex: 9999,
      boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
      animation: 'slideUp 0.3s ease-out'
    }}>
      ⚠️ {error}
    </div>
  ) : null;

  // 1. 주의사항 화면
  const renderCautions = () => (
    <div className="app-container camera-cautions">
      <div className="camera-status-bar">
        <div className="camera-time-center"></div>
      </div>

      <div className="camera-sheet">
        <button className="camera-sheet-close" type="button" onClick={onBack}>
          ✕
        </button>

        <div className="camera-sheet-title">
          <span className="camera-sheet-title-highlight">Before scanning</span>
          <br />
          <span className="camera-sheet-title-highlight">Make sure you know this!</span>
        </div>

        <div className="camera-sheet-description">
          For accurate and detailed skin scanning,
          <br />
          please look straight to the camera.
        </div>

        <div className="camera-tip-card">
          If you have allergies or rashes, please make sure the affected area is visible.
        </div>

        <div className="camera-tip-card">
          Accessories such as masks, hats, etc. should be included in the scan.
        </div>

        <div className="camera-tip-card">
          Scan your skin tone and condition from the front.
        </div>

        <button
          className="camera-sheet-confirm"
          type="button"
          onClick={() => setStep('before')}
          disabled={loading}
        >
          {loading ? 'Connecting...' : 'Next'}
        </button>
      </div>
    </div>
  );

  // 2. 실시간 카메라 화면
  const renderBefore = () => (
    <div className="app-container camera-before">
      <div className="status-bar">
        <div className="time-text"></div>
      </div>

      {/* 🔥 브라우저 카메라 스트림 - 전체 화면으로 표시 */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        backgroundColor: '#000',
        overflow: 'hidden',
        zIndex: 1
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) scaleX(-1)', // 중앙 정렬 + 거울 모드
            minWidth: '100%',
            minHeight: '100%',
            width: 'auto',
            height: 'auto',
            maxWidth: 'none',
            objectFit: 'cover'
          }}
        />
        {/* 카메라 로딩 중 표시 */}
        {!streamReady && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: 'white',
            fontSize: '16px',
            textAlign: 'center',
            zIndex: 2
          }}>
            📷 Camera Loading...
          </div>
        )}
      </div>

      {/* 오버레이 (가이드 라인 등) */}
      <div className="overlay-rectangle" style={{ zIndex: 2 }}></div>

      {/* 뒤로가기 버튼 */}
      <div className="header-frame" style={{ zIndex: 10 }}>
        <div className="back-arrow" onClick={() => setStep('cautions')}>
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/arrow-left.svg`}
            alt="Back"
          />
        </div>
      </div>

      {/* 촬영 가이드 텍스트
    <div style={{
      position: 'absolute',
      bottom: '150px',
      left: '50%',
      transform: 'translateX(-50%)',
      color: 'white',
      fontSize: '16px',
      fontWeight: '500',
      textAlign: 'center',
      textShadow: '0 2px 8px rgba(0,0,0,0.8)',
      zIndex: 10,
      pointerEvents: 'none',
      padding: '8px 20px',
      backgroundColor: 'rgba(0,0,0,0.3)',
      borderRadius: '20px'
    }}>
      원하는 구도에서<br />촬영 버튼을 눌러주세요
    </div>
    */}

      {/* 촬영 버튼 */}
      <div
        className="camera-button"
        onClick={handleCapture}
        style={{
          cursor: loading ? 'not-allowed' : 'pointer',
          zIndex: 10
        }}
      >
        <img
          src={`${process.env.PUBLIC_URL}/assets/icons/camerabutton.svg`}
          alt="Camera Button"
          className="camera-button-icon"
          style={{ opacity: loading ? 0.5 : 1 }}
        />
      </div>

      <ErrorToast />

      <div className="home-indicator-wrapper" style={{ zIndex: 10 }}>
        <div className="home-indicator-bar"></div>
      </div>
    </div>
  );

  // 3. 스캔 중 화면
  const renderScanning = () => (
    <div className="app-container camera">
      {/* 스캔 중 배경 */}
      <div className="background-image" style={{
        backgroundImage: capturedImage ? `url(${capturedImage})` : 'none',
        backgroundColor: '#000',
        filter: 'blur(10px)'
      }}>
      </div>
      <div className="overlay-rectangle" style={{ opacity: 0.8 }}></div>

      <div className="status-bar">
        <div className="time"></div>
      </div>

      <div className="header-frame">
        <div className="back-arrow" onClick={() => setStep('before')}>
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/arrow-left.svg`}
            alt="Back"
          />
        </div>
      </div>

      <div className="scan-message">
        <span className="scan-username">{userName}</span>
        <span>'s outfit</span>
        <br />
        <span>scanning...</span>
      </div>

      {/* 로딩 스피너 */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 10
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(255,255,255,0.2)',
          borderTopColor: 'white',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }}></div>
      </div>

      <div className="camera-button camera-button-disabled" style={{ opacity: 0.5 }}>
        <img
          src={`${process.env.PUBLIC_URL}/assets/icons/camerabutton.svg`}
          alt="Camera Button"
          className="camera-button-icon"
        />
      </div>

      <div className="home-indicator">
        <div className="home-bar"></div>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );

  // 4. 완료 화면
  const renderDone = () => (
    <div className="app-container camera-done">
      {/* 촬영된 이미지를 배경으로 */}
      <div
        className="background-image"
        style={{
          backgroundImage: capturedImage ? `url(${capturedImage})` : 'none',
          filter: 'blur(25px)',
          backgroundColor: '#000'
        }}
      />
      <div className="gradient-overlay"></div>

      <div className="status-bar">
        <div className="time"></div>
      </div>

      <div className="header-frame">
        <div className="back-arrow" onClick={handleRetake}>
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/arrow-left.svg`}
            alt="Back"
          />
        </div>
      </div>

      <div className="scan-complete">
        <span className="scan-complete-username">{userName}</span>
        <span>`s outfit</span>
        <br />
        <span>scan complete</span>
      </div>

      {/* 촬영된 사진 프리뷰 */}
      <div className="photo-preview" style={{
        backgroundImage: capturedImage ? `url(${capturedImage})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        position: 'relative'
      }}>
        {/* 분석 결과 오버레이 */}
        {analysisResult && (
          <div style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            padding: '15px',
            background: 'rgba(0,0,0,0.7)',
            color: 'white',
            borderBottomLeftRadius: '28px',
            borderBottomRightRadius: '28px',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '8px', fontSize: '16px', fontWeight: 'bold' }}>
              {analysisResult.style || '스타일 분석 완료'}
            </div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {analysisResult.weather_recommendation || '오늘 날씨에 딱 맞는 옷차림이에요!'}
            </div>
          </div>
        )}
      </div>

      {/* 완료 버튼 */}
      <div
        className="camera-check"
        onClick={onBack}
        style={{
          backgroundImage: `url(${process.env.PUBLIC_URL}/assets/icons/check.svg)`
        }}
      ></div>

    </div>
  );

  // 렌더링
  switch (step) {
    case 'cautions':
      return renderCautions();
    case 'before':
      return renderBefore();
    case 'scanning':
      return renderScanning();
    case 'done':
      return renderDone();
    default:
      return renderCautions();
  }
};

export default CameraScreen;