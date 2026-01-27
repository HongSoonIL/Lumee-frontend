import React, { useState, useEffect } from 'react';

function WeatherScreen() {
  const [weatherData, setWeatherData] = useState(null);
  const [userProfile, setUserProfile] = useState(null);

  /**
   * 날씨 데이터 가져오기
   */
  const fetchWeatherData = async (location) => {
    try {
      const response = await fetch(`${API_URL}/api/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location })
      });

      const data = await response.json();
      setWeatherData(data);

    } catch (error) {
      console.error('날씨 데이터 조회 실패:', error);
    }
  };

  /**
   * 사용자 프로필 가져오기
   */
  const fetchUserProfile = async (userId) => {
    try {
      const profile = await getUserProfile(userId);
      setUserProfile(profile);

    } catch (error) {
      console.error('프로필 조회 실패:', error);
    }
  };

  return (
    <div className="weather-screen">
      {/* 기존 날씨 UI */}
      <div className="weather-content">
        <h1>Lumee 날씨 어시스턴트</h1>

        {weatherData && (
          <div className="weather-info">
            {/* 날씨 정보 표시 */}
          </div>
        )}
      </div>

      <style jsx>{`
        .weather-screen {
          position: relative;
          width: 100%;
          min-height: 100vh;
        }
      `}</style>
    </div>
  );
}

export default WeatherScreen;