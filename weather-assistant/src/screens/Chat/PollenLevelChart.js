import React, { useState, useEffect, useRef } from 'react';

/**
 * 날짜 문자열을 Pollen Level 제목으로 포맷팅
 */
const formatTitle = (dateString) => {
    if (!dateString) {
        return "Pollen Level";
    }

    const dateStr = String(dateString);

    if (dateStr.match(/^[A-Za-z]+ \d{1,2}, \d{4}$/)) {
        return `${dateStr} Pollen Level`;
    }

    return "Pollen Level";
};

/**
 * UPI 값에 따른 실시간 그라데이션 색상 계산
 * UPI 0-5: Very low → Very high
 */
const getRealTimeBackgroundColor = (position) => {
    const normalizedPos = position / 100;

    // 꽃가루 그라데이션: 초록(Very low) → 진한 빨강(Very high)
    const gradientStops = [
        { pos: 0, color: { r: 126, g: 214, b: 168 } },      // #7ED6A8 (Very low)
        { pos: 0.2, color: { r: 255, g: 237, b: 127 } },    // #FFED7F (Low)
        { pos: 0.4, color: { r: 255, g: 200, b: 89 } },     // #FFC859 (Moderate)
        { pos: 0.6, color: { r: 255, g: 160, b: 89 } },     // #FFA059 (High)
        { pos: 1, color: { r: 243, g: 108, b: 108 } }       // #F36C6C (Very high)
    ];

    for (let i = 0; i < gradientStops.length - 1; i++) {
        const currentStop = gradientStops[i];
        const nextStop = gradientStops[i + 1];

        if (normalizedPos >= currentStop.pos && normalizedPos <= nextStop.pos) {
            const segmentLength = nextStop.pos - currentStop.pos;
            const positionInSegment = normalizedPos - currentStop.pos;
            const ratio = segmentLength === 0 ? 0 : positionInSegment / segmentLength;

            const r = Math.round(currentStop.color.r + (nextStop.color.r - currentStop.color.r) * ratio);
            const g = Math.round(currentStop.color.g + (nextStop.color.g - currentStop.color.g) * ratio);
            const b = Math.round(currentStop.color.b + (nextStop.color.b - currentStop.color.b) * ratio);

            return { r, g, b, css: `rgb(${r}, ${g}, ${b})` };
        }
    }

    const lastStop = gradientStops[gradientStops.length - 1];
    return {
        r: lastStop.color.r,
        g: lastStop.color.g,
        b: lastStop.color.b,
        css: `rgb(${lastStop.color.r}, ${lastStop.color.g}, ${lastStop.color.b})`
    };
};

/**
 * 꽃가루 레벨 차트 컴포넌트
 * @param {Object} props
 * @param {number} props.value - UPI 값 (0-5)
 * @param {string} props.category - 카테고리 (Very low, Low, Moderate, High, Very high)
 * @param {string} props.date - 날짜 문자열
 */
const PollenLevelChart = ({ value = 0, category = "Very low", date }) => {
    const [shouldAnimate, setShouldAnimate] = useState(false);
    const [animatedValue, setAnimatedValue] = useState(0);
    const [indicatorVisible, setIndicatorVisible] = useState(false);
    const indicatorRef = useRef(null);

    // UPI 0-5를 0-100 퍼센트로 변환
    const targetPosition = Math.min((value / 5) * 100, 100);

    const realTimeColor = getRealTimeBackgroundColor(targetPosition);

    // 숫자 카운트업 애니메이션
    useEffect(() => {
        if (!shouldAnimate) return;

        let startTime = null;
        const duration = 2000;
        const delay = 400;

        const animateNumber = (timestamp) => {
            if (!startTime) {
                startTime = timestamp + delay;
                requestAnimationFrame(animateNumber);
                return;
            }

            const elapsed = timestamp - startTime;
            const progress = Math.max(0, Math.min(elapsed / duration, 1));

            const easedProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.max(0, easedProgress * value);
            setAnimatedValue(currentValue);

            if (progress < 1) {
                requestAnimationFrame(animateNumber);
            } else {
                setAnimatedValue(value);
            }
        };

        const timeoutId = setTimeout(() => {
            requestAnimationFrame(animateNumber);
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [shouldAnimate, value]);

    // 인디케이터 이동 애니메이션
    useEffect(() => {
        if (!shouldAnimate) return;

        let startTime = null;
        const totalDuration = 2000;
        const delay = 400;

        const presetIndicator = () => {
            if (indicatorRef.current) {
                const startColorInfo = getRealTimeBackgroundColor(0);
                indicatorRef.current.style.backgroundColor = startColorInfo.css;
                indicatorRef.current.style.left = '0%';
                indicatorRef.current.style.opacity = '0';
                indicatorRef.current.style.transform = 'translate(-50%, -50%) scale(0)';
            }
        };

        const animate = (timestamp) => {
            if (!startTime) {
                startTime = timestamp + delay;
                setIndicatorVisible(true);

                requestAnimationFrame(() => {
                    presetIndicator();
                    requestAnimationFrame(animate);
                });
                return;
            }

            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / totalDuration, 1);

            let opacity, scale;
            if (progress < 0.1) {
                const appearProgress = progress / 0.1;
                const easeOutBack = 1 - Math.pow(1 - appearProgress, 3);
                opacity = easeOutBack;
                scale = 0.2 + (easeOutBack * 0.8);
            } else {
                opacity = 1;
                scale = 1;
            }

            const easedProgress = 1 - Math.pow(1 - progress, 2.5);
            const currentPos = easedProgress * targetPosition;
            const colorInfo = getRealTimeBackgroundColor(currentPos);

            if (indicatorRef.current) {
                const indicatorRadius = 13;
                const containerWidth = indicatorRef.current.parentElement?.offsetWidth || 300;
                const minPosition = (indicatorRadius / containerWidth) * 100;
                const maxPosition = 100 - (indicatorRadius / containerWidth) * 100;
                const clampedPosition = Math.max(minPosition, Math.min(currentPos, maxPosition));

                indicatorRef.current.style.backgroundColor = colorInfo.css;
                indicatorRef.current.style.left = `${clampedPosition}%`;
                indicatorRef.current.style.opacity = opacity;
                indicatorRef.current.style.transform = `translate(-50%, -50%) scale(${scale})`;
                indicatorRef.current.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.3)';
            }

            if (progress < 1) {
                requestAnimationFrame(animate);
            } else {
                if (indicatorRef.current) {
                    const cleanDate = date?.replace(/[^a-zA-Z0-9]/g, '') || 'default';
                    indicatorRef.current.classList.add(`pollen-indicator-${value}-${cleanDate}`);
                }
            }
        };

        const timeoutId = setTimeout(() => {
            requestAnimationFrame(animate);
        }, 100);

        return () => clearTimeout(timeoutId);
    }, [shouldAnimate, targetPosition, value, date]);

    useEffect(() => {
        const timer = setTimeout(() => {
            setShouldAnimate(true);
        }, 300);

        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const currentRef = indicatorRef.current;
        return () => {
            if (currentRef) {
                currentRef.style.animation = 'none';
            }
        };
    }, []);

    const startColor = getRealTimeBackgroundColor(0);
    const finalColor = getRealTimeBackgroundColor(targetPosition);

    const styles = {
        pollenBox: {
            background: 'rgba(255, 255, 255, 0.08)',
            borderRadius: '12px',
            padding: '16px 16px 16px 16px',
            color: 'white',
            width: '100%',
            maxWidth: '320px',
            marginTop: '12px',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
            border: '0.5px solid rgba(255, 255, 255, 0.3)',
        },

        progressContainer: {
            marginTop: '10px',
            marginBottom: '8px',
            position: 'relative',
            width: '100%',
            height: '18px',
            background: 'linear-gradient(90deg, #7ED6A8 0%, #FFED7F 20%, #FFC859 40%, #FFA059 60%, #F36C6C 100%)',
            borderRadius: '12px',
            overflow: 'visible',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
        },
    };

    const cleanDate = date?.replace(/[^a-zA-Z0-9]/g, '') || 'default';

    return (
        <div>
            <style>{`
        .pollen-indicator-${value}-${cleanDate} {
          animation: pollenIndicatorPulse-${value}-${cleanDate} 3s ease-in-out infinite 1.8s;
        }
        
        @keyframes pollenIndicatorPulse-${value}-${cleanDate} {
          0%, 100% {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 0 ${finalColor.css}40;
          }
          50% {
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3), 0 0 0 8px ${finalColor.css}00;
          }
        }
        
        @keyframes pollenBadgeReveal {
          0% {
            opacity: 0;
            transform: scale(0.3) rotateZ(-10deg);
          }
          50% {
            opacity: 1;
            transform: scale(1.1) rotateZ(5deg);
          }
          70% {
            transform: scale(0.95) rotateZ(-2deg);
          }
          85% {
            transform: scale(1.02) rotateZ(1deg);
          }
          100% {
            opacity: 1;
            transform: scale(1) rotateZ(0deg);
          }
        }
      `}</style>

            <div style={styles.pollenBox}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                            <p style={{ fontSize: '15px', fontWeight: '400', color: '#ffffff', margin: 0, textShadow: '0 0 10px rgba(255, 255, 255, 0.45)' }}>
                                {formatTitle(date)}
                            </p>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <p style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.8)', fontWeight: '400', margin: 0 }}>
                                    Universal Pollen Index
                                </p>
                                <span style={{
                                    padding: '2px 6px',
                                    borderRadius: '20px',
                                    fontSize: '8px',
                                    fontWeight: '600',
                                    textTransform: 'capitalize',
                                    letterSpacing: '0.5px',
                                    backgroundColor: realTimeColor.css,
                                    color: 'black',
                                    opacity: 0,
                                    transform: 'scale(0.3) rotateZ(-10deg)',
                                    animation: shouldAnimate ? 'pollenBadgeReveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) 2.5s forwards' : 'none',
                                }}>
                                    {category}
                                </span>
                            </div>
                        </div>
                        <div>
                            <p style={{
                                fontSize: '26px',
                                fontWeight: '700',
                                color: realTimeColor.css,
                                lineHeight: '1',
                                textAlign: 'right',
                                margin: 0,
                            }}>
                                {Math.max(0, animatedValue.toFixed(1))}
                            </p>
                            <p style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.65)', fontWeight: '400', textAlign: 'center', margin: 0 }}>
                                UPI
                            </p>
                        </div>
                    </div>
                </div>

                <div style={styles.progressContainer} className="progress-container">
                    {indicatorVisible && (
                        <div
                            ref={indicatorRef}
                            className="real-time-indicator"
                            style={{
                                position: 'absolute',
                                top: '50%',
                                left: '0%',
                                transform: 'translate(-50%, -50%) scale(0)',
                                width: '26px',
                                height: '26px',
                                borderRadius: '50%',
                                backgroundColor: startColor.css,
                                border: '2px solid #ffffff',
                                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
                                zIndex: 10,
                                opacity: 0,
                                transition: 'none',
                            }}
                        />
                    )}
                </div>

                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '9px',
                    color: 'rgba(255, 255, 255, 0.85)',
                    padding: '0 0px',
                }}>
                    <p>Very low</p>
                    <p>Low</p>
                    <p>Moderate</p>
                    <p>High</p>
                    <p>Very high</p>
                </div>
            </div>
        </div>
    );
};

export default PollenLevelChart;
