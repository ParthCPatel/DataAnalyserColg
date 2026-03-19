import React, { useState, useEffect } from 'react';
import axios from '../../api/axiosConfig';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';

import './DashboardNote.css';

interface DashboardNoteProps {
    noteId?: string;
    initialText?: string;
    readOnly?: boolean;
    isTitle?: boolean;
    onChange?: (content: string) => void;
}

export interface DashboardNoteHandle {
    save: () => Promise<void>;
}

const DashboardNote = React.forwardRef<DashboardNoteHandle, DashboardNoteProps>(({ noteId, initialText, readOnly, isTitle, onChange }, ref) => {
    const [content, setContent] = useState(initialText || "");
    const [error, setError] = useState(false);
    const contentRef = React.useRef(content);

    // Keep ref in sync
    React.useEffect(() => {
        contentRef.current = content;
    }, [content]);

    // Fetch note content if noteId is present
    useEffect(() => {
        if (noteId) {
            axios.get(`/notes/${noteId}`)
                .then(res => setContent(res.data.content))
                .catch(err => {
                    console.error("Failed to fetch note", err);
                    setError(true);
                });
        }
    }, [noteId]);

    // Save function
    const saveNote = async () => {
        if (!noteId) return;
        try {
            // Use the ref to ensure we always have the freshest content 
            // even if called from a closure (like unmount or manual save)
            await axios.put(`/notes/${noteId}`, { content: contentRef.current });
        } catch (err) {
            console.error("Failed to save note", err);
            setError(true);
            throw err;
        }
    };

    React.useImperativeHandle(ref, () => ({
        save: saveNote
    }));

    // Sync internal content with initialText if it changes (ONLY for read-only preview)
    useEffect(() => {
        if (initialText !== undefined && readOnly) {
            setContent(initialText);
        }
    }, [initialText, readOnly]);

    // Auto-save logic
    useEffect(() => {
        if (readOnly || !noteId) return;

        const delayDebounceFn = setTimeout(() => {
            saveNote();
        }, 500); // Shorter debounce: 500ms

        return () => clearTimeout(delayDebounceFn);
    }, [content, noteId, readOnly]);

    // Emergency save on unmount
    useEffect(() => {
        return () => {
            if (!readOnly && noteId && contentRef.current !== initialText) {
                axios.put(`/notes/${noteId}`, { content: contentRef.current }).catch(console.error);
            }
        };
    }, [noteId, readOnly, initialText]);

    const handleChange = (value: string) => {
        setContent(value);
        if (onChange) {
            onChange(value);
        }
    };

    if (error) return <div className="note-error">Failed to load note.</div>;

    if (readOnly) {
        return (
            <div className={`dashboard-note read-only ${isTitle ? 'title-note' : ''}`}>
                <div
                    className="note-content-display ql-editor"
                    dangerouslySetInnerHTML={{ __html: content }}
                />
            </div>
        );
    }

    const modules = {
        toolbar: [
            [{ 'header': [1, 2, 3, false] }, { 'font': [] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'color': [] }, { 'background': [] }],
            [{ 'list': 'ordered' }, { 'list': 'bullet' }],
            [{ 'align': [] }],
            ['link', 'clean']
        ],
    };

    return (
        <div className={`dashboard-note ${isTitle ? 'title-note' : ''}`}>
            <ReactQuill
                theme="snow"
                value={content}
                onChange={handleChange}
                modules={modules}
                placeholder={isTitle ? "Type your title here..." : "Type your notes here..."}
            />
        </div>
    );
});

DashboardNote.displayName = "DashboardNote";

export default DashboardNote;
