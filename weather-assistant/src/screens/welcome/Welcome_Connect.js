import React, { useState } from 'react';
import './Welcome_Connect.css';
import { ArrowRight } from 'lucide-react';

const WelcomeConnect = ({ onNext, onBack }) => {
  return (
    <div className="app-container welcome-connect-root">
      {/* 뒤로가기 */}
      <div className="frame-header">
        <div className="arrow-back" onClick={onBack}>
          <img
            src={`${process.env.PUBLIC_URL}/assets/icons/arrow-left.svg`}
            alt="Back"
            className="arrow-back-icon"
          />
        </div>
      </div>

      {/* 아이콘 */}
      <div className="connect-icon-wrapper">
        <img
          src={`${process.env.PUBLIC_URL}/assets/icons/lumee-logo.svg`}
          alt="Lumee Logo"
          style={{ width: '80px', height: '80px' }}
        />
      </div>

      {/* 텍스트 */}
      <h2 className="connect-title">
        Lumee에 오신 것을 환영합니다!
      </h2>

      <p className="connect-desc">
        날씨 정보를 확인하고{'\n'}AI 어시스턴트와 대화해보세요.
      </p>

      {/* 버튼 영역 */}
      <button className="connect-btn primary" onClick={onNext}>
        시작하기 <ArrowRight size={20} />
      </button>
    </div>
  );
};

export default WelcomeConnect;