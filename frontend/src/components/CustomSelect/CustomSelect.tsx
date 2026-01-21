import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import './CustomSelect.css';

interface Option {
    value: string | number;
    label: string;
    subLabel?: string;
    icon?: React.ElementType;
}

interface CustomSelectProps {
    options: Option[];
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    className?: string;
}

const CustomSelect: React.FC<CustomSelectProps> = ({ 
    options, 
    value, 
    onChange, 
    placeholder = "Select...", 
    disabled = false,
    className = "" 
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const selectedOption = options.find(opt => opt.value === value);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (optionValue: string | number) => {
        onChange(optionValue.toString());
        setIsOpen(false);
    };

    return (
        <div 
            className={`custom-select-container ${disabled ? 'disabled' : ''} ${className}`} 
            ref={containerRef}
        >
            <div 
                className={`custom-select-trigger ${isOpen ? 'open' : ''}`} 
                onClick={() => !disabled && setIsOpen(!isOpen)}
            >
                <div className="selected-value">
                    {selectedOption ? (
                        <>
                            {selectedOption.icon && <selectedOption.icon size={16} className="option-icon" />}
                            <span>{selectedOption.label}</span>
                        </>
                    ) : (
                        <span className="placeholder">{placeholder}</span>
                    )}
                </div>
                <ChevronDown size={16} className={`chevron ${isOpen ? 'rotate' : ''}`} />
            </div>

            {isOpen && (
                <div className="custom-select-options">
                    {options.map((option) => (
                        <div 
                            key={option.value} 
                            className={`custom-option ${option.value === value ? 'selected' : ''}`}
                            onClick={() => handleSelect(option.value)}
                        >
    <div className="option-label">
                                {option.icon && <option.icon size={16} className="option-icon" />}
                                <div className="option-text-group">
                                    <span className="option-main">{option.label}</span>
                                    {option.subLabel && <span className="option-sub">{option.subLabel}</span>}
                                </div>
                            </div>
                            {option.value === value && <Check size={14} className="check-icon" />}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CustomSelect;
