import React, { useState } from 'react';
import { FaEye, FaEyeSlash } from 'react-icons/fa';

const PasswordInput = ({ value, onChange, placeholder = '••••••', required, minLength, name, autoComplete, className = 'login-input' }) => {
    const [show, setShow] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <input
                type={show ? 'text' : 'password'}
                className={className}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                required={required}
                minLength={minLength}
                name={name}
                autoComplete={autoComplete}
                style={{ paddingRight: 44, width: '100%' }}
            />
            <button
                type="button"
                onClick={() => setShow((s) => !s)}
                aria-label={show ? 'Hide password' : 'Show password'}
                style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', color: '#6b7280',
                    padding: 4, display: 'flex', alignItems: 'center',
                }}
            >
                {show ? <FaEyeSlash /> : <FaEye />}
            </button>
        </div>
    );
};

export default PasswordInput;
