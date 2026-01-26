import React, { useState, useEffect } from 'react';
import './Splash.css';

function Splash() {
    const [currentTime, setCurrentTime] = useState('');

    useEffect(() => {
        // 현재 시간 표시
        const updateTime = () => {
            const now = new Date();
            const hours = now.getHours().toString().padStart(2, '0');
            const minutes = now.getMinutes().toString().padStart(2, '0');
            setCurrentTime(`${hours}:${minutes}`);
        };

        updateTime();
        const timer = setInterval(updateTime, 1000);

        return () => clearInterval(timer);
    }, []);

    return (
        <div className="splash-screen">
            {/* 상태바 */}
            <div className="splash-status-bar">
                <div className="splash-status-time">{currentTime}</div>
                <div className="splash-status-icons">
                    <div className="splash-status-icon"></div>
                    <div className="splash-status-icon"></div>
                    <div className="splash-status-icon"></div>
                </div>
            </div>

            {/* 로고 중앙 배치 - 텍스트만 */}
            <div className="splash-content">
                <div className="splash-text">Lumee</div>
            </div>

            {/* 제스처 바 */}
            <div className="splash-gesture-bar">
                <div className="splash-gesture-handle"></div>
            </div>
        </div>
    );
}

export default Splash;
