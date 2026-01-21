import React, { useState, useEffect } from 'react';
import axios from '../../api/axiosConfig';

import './DashboardNote.css';

interface DashboardNoteProps {
    noteId?: string;
    initialText?: string;
    readOnly?: boolean;
}

export interface DashboardNoteHandle {
    save: () => Promise<void>;
}

const DashboardNote = React.forwardRef<DashboardNoteHandle, DashboardNoteProps>(({ noteId, initialText, readOnly }, ref) => {
    const [content, setContent] = useState(initialText || "");
    const [error, setError] = useState(false);

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
        if (!noteId) return; // Can't save persistence without ID
        try {
            await axios.put(`/notes/${noteId}`, { content });
        } catch (err) {
            console.error("Failed to save note", err);
            setError(true);
            throw err;
        }
    };

    React.useImperativeHandle(ref, () => ({
        save: saveNote
    }));

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setContent(e.target.value);
    };

    if (error) return <div className="note-error">Failed to load note.</div>;

    if (readOnly) {
        return (
            <div className="dashboard-note read-only">
                <div className="note-content-display">
                    {content}
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-note">
            <textarea 
                className="note-textarea"
                value={content}
                onChange={handleChange}
                placeholder="Type your notes here..."
            />
        </div>
    );
});

DashboardNote.displayName = "DashboardNote";

export default DashboardNote;
