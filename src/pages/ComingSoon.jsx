import React from 'react';
import { FaClock } from 'react-icons/fa';

const ComingSoon = ({ title }) => {
    return (
        <div className="coming-soon">
            <div className="coming-soon-icon">
                <FaClock />
            </div>
            <h2>Tez kunda</h2>
            <p><strong>{title}</strong> bo'limi tez orada qo'shiladi.</p>
            <span className="coming-soon-badge">Coming Soon</span>
        </div>
    );
};

export default ComingSoon;
