import React from "react";
import "./AnnouncementBanner.css";

const MESSAGE = "Bulk orders are available for all kinds of functions and events.";

export default function AnnouncementBanner() {
  return (
    <div className="announcement-banner" role="region" aria-label="Announcement">
      <div className="announcement-track">
        <div className="announcement-group">
          {[0, 1, 2].map((idx) => (
            <span key={idx} className="announcement-item">
              <span className="announcement-text">{MESSAGE}</span>
              <span className="announcement-dot" aria-hidden="true">•</span>
            </span>
          ))}
        </div>
        <div className="announcement-group" aria-hidden="true">
          {[0, 1, 2].map((idx) => (
            <span key={idx} className="announcement-item">
              <span className="announcement-text">{MESSAGE}</span>
              <span className="announcement-dot" aria-hidden="true">•</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

