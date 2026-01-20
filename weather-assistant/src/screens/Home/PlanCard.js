import React, { useState, useRef } from 'react';
import './Home.css';

const PlanCard = ({ schedule, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  // 초기 시간 값 추출 (HH:mm 형식)
  const extractTime = (dateTimeStr) => {
    if (!dateTimeStr || !String(dateTimeStr).includes('T')) return "09:00";
    return String(dateTimeStr).split('T')[1].substring(0, 5);
  };

  const [editData, setEditData] = useState({
    title: schedule.title || schedule.summary,
    subtitle: schedule.location || schedule.subtitle || '',
    body: schedule.body || schedule.description,
    startTime: extractTime(schedule.start),
    endTime: extractTime(schedule.end)
  });

  // 꾹 누르기(Long Press) 로직
  const timerRef = useRef(null);
  const isLongPressTriggered = useRef(false);

  const handlePressStart = (e) => {
    // 부모 슬라이더가 가로채지 못하도록 전파 차단
    e.stopPropagation();

    isLongPressTriggered.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressTriggered.current = true;
      setIsEditing(true);
    }, 300);
  };

  const handlePressEnd = (e) => {
    e.stopPropagation();
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  const handleSave = () => {
    // eventId 안전하게
    const eventId = schedule.id || schedule.event_id;
    if (!eventId) {
      alert("Event id not found. Can't update.");
      return;
    }

    // 날짜 정규화 함수
    const normalizeDate = (d) => {
      if (!d) return null;
      const s = String(d);
      return s.includes('T') ? s.split('T')[0] : s;
    };

    // 날짜 확보 (정규화 포함)
    const startDateStr = normalizeDate(schedule.date) || normalizeDate(schedule.start);

    if (!startDateStr) {
      alert("Event date not found. Can't update.");
      return;
    }

    // 시간 파싱 & duration 계산 (자정 넘어가는 일정 포함)
    const [sh, sm] = editData.startTime.split(':').map(Number);
    const [eh, em] = editData.endTime.split(':').map(Number);

    const startMinutes = sh * 60 + sm;
    const endMinutes = eh * 60 + em;

    let durationMinutes = endMinutes - startMinutes;
    if (durationMinutes <= 0) durationMinutes += 24 * 60;

    // 최대 23.5시간 제한
    const MAX_MINUTES = 23 * 60 + 30; // 1410
    if (durationMinutes > MAX_MINUTES) {
      alert("Event duration can't exceed 23.5 hours.");
      return;
    }

    // 자정 넘어가면 endDate는 다음날
    let endDateStr = startDateStr;
    if (endMinutes <= startMinutes) {
      const endDateObj = new Date(`${startDateStr}T00:00:00`);
      endDateObj.setDate(endDateObj.getDate() + 1);
      endDateStr = endDateObj.toISOString().split('T')[0];
    }

    const updatedData = {
      summary: editData.title,
      location: editData.subtitle,
      description: editData.body,
      startDateTime: `${startDateStr}T${editData.startTime}:00+09:00`,
      endDateTime: `${endDateStr}T${editData.endTime}:00+09:00`
    };

    onUpdate(eventId, updatedData);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="plan-card editing" onClick={(e) => e.stopPropagation()}>
        <input
          className="edit-input title"
          value={editData.title}
          onChange={(e) => setEditData({ ...editData, title: e.target.value })}
          placeholder="Title"
        />
        <input
          className="edit-input subtitle"
          value={editData.subtitle}
          onChange={(e) => setEditData({ ...editData, subtitle: e.target.value })}
          placeholder="Location"
        />

        <div className="edit-time-row">
          <input
            type="time"
            value={editData.startTime}
            onChange={(e) => setEditData({ ...editData, startTime: e.target.value })}
          />
          <span>~</span>
          <input
            type="time"
            value={editData.endTime}
            onChange={(e) => setEditData({ ...editData, endTime: e.target.value })}
          />
        </div>

        <textarea
          className="edit-textarea"
          value={editData.body}
          onChange={(e) => setEditData({ ...editData, body: e.target.value })}
          placeholder="Description"
        />

        {/* ✅ 핵심 수정: Save/Cancel 버튼이 슬라이더/카드 이벤트에 먹히지 않게 차단 */}
        <div className="edit-actions">
          <button
            className="edit-save-btn"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              handleSave();
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            Save
          </button>

          <button
            className="edit-cancel-btn"
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setIsEditing(false);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="plan-card"
      onMouseDown={handlePressStart}
      onMouseUp={handlePressEnd}
      onMouseLeave={handlePressEnd}
      onTouchStart={handlePressStart}
      onTouchEnd={handlePressEnd}
    >
      <button
        className="plan-card-delete-btn"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        &times;
      </button>

      {schedule.image && (
        <img className="plan-card-image" src={schedule.image} alt={schedule.title} />
      )}
      <div className="plan-card-tag-row">
        <span className="plan-card-tag-pill">{schedule.tag}</span>
      </div>

      <div className="plan-card-title-row">
        <h2 className="plan-card-title">{schedule.title}</h2>
        <span className="plan-card-time">{schedule.timeRange}</span>
      </div>

      <div className="plan-card-sub-row">
        <p className="plan-card-subtitle">{schedule.subtitle}</p>
        <span className="plan-card-time-eta">{schedule.etaText}</span>
      </div>

      <p className="plan-card-body">{schedule.body}</p>
    </div>
  );
};

export default PlanCard;
