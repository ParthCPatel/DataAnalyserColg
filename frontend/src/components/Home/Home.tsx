import React, { useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import type { AppDispatch } from '../../store';
import { setSchema, setDatabaseState, setUploadId, resetSession, setUploadedDbPath } from '../../features/appSlice'; // Added resetSession // Updated import
import { Plus, Database, Loader2, ChevronDown } from 'lucide-react';
import axios from '../../api/axiosConfig';

const Home: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cleanMode, setCleanMode] = useState(false);
  const [showModeMenu, setShowModeMenu] = useState(false);

  const handleUpload = async (filesArg: FileList | null, clean: boolean) => {
    // ... existing implementation ...
    const filesToUpload = filesArg || selectedFiles;
    if (!filesToUpload || filesToUpload.length === 0) return;

    // Reset previous session state to avoid ghost data
    dispatch(resetSession());

    setUploading(true);
    const formData = new FormData();
    // Append all selected files
    for (let i = 0; i < filesToUpload.length; i++) {
        console.log(`Appending file ${i}: ${filesToUpload[i].name}`);
        formData.append("database", filesToUpload[i]);
    }

    console.log(`Sending upload request to backend (Clean Mode: ${clean})...`);

    try {
      const response = await axios.post(
        `/upload-db?clean=${clean}`,
        formData
      );
      
      console.log("Upload Success:", response.data);

      dispatch(setSchema(response.data.schema));
      dispatch(setDatabaseState(response.data.databaseState));
      dispatch(setUploadId(response.data.uploadId));
      dispatch(setUploadedDbPath(response.data.path)); // Persist the file path
      navigate("/dashboard");
    } catch (error: any) {
      console.error("Upload failed", error);
      setError("Upload failed. Please try again.");
      alert("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("File input changed");
    if (e.target.files && e.target.files.length > 0) {
      console.log(`Files selected: ${e.target.files.length}`);
      setSelectedFiles(e.target.files);
      // Auto trigger upload with current mode
      handleUpload(e.target.files, cleanMode);
    } else {
        console.log("No files in target");
    }
    // Reset value to allow re-selection
    e.target.value = '';
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center', // Center vertically
    minHeight: 'calc(100vh - 64px)', // Account for navbar
    width: '100%',
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: '40px'
  };

  const buttonStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '16px 32px',
    fontSize: '18px',
    fontWeight: 600,
    background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    width: '240px',
    justifyContent: 'center',
    boxShadow: '0 8px 30px rgba(99, 102, 241, 0.4)',
    transition: 'transform 0.2s, box-shadow 0.2s',
    marginTop: '16px'
  };

  return (
    <div style={containerStyle}>
       <div className="background-glow glow-blue" style={{ opacity: 0.5 }}></div>
       <div className="background-glow glow-purple" style={{ opacity: 0.5 }}></div>

       <div style={{ zIndex: 10, textAlign: 'center' }}>
          <div style={{ marginBottom: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="icon-wrapper" style={{ width: '64px', height: '64px', marginBottom: '24px' }}>
                <Database className="icon" style={{ width: '32px', height: '32px' }} />
            </div>
            <h1 style={{ fontSize: '48px', fontWeight: 800, letterSpacing: '-1px', marginBottom: '16px' }}>
              Data Analyser
            </h1>
            <p style={{ fontSize: '18px', color: 'var(--text-secondary)', maxWidth: '500px' }}>
               Upload your data and start asking questions in natural language.
            </p>
          </div>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            id="file-upload"
            className="hidden"
            style={{ display: 'none' }}
            accept=".sqlite,.db,.csv"
            multiple
          />

          {/* Header buttons removed - moved to Global Navbar */}
          <div style={{ height: '24px' }}></div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              
              {/* Main Menu Button */}
              <div style={{ position: 'relative' }}>
                  <button
                    onClick={() => setShowModeMenu(!showModeMenu)}
                    style={buttonStyle}
                    disabled={uploading}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 12px 40px rgba(99, 102, 241, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 8px 30px rgba(99, 102, 241, 0.4)';
                    }}
                  >
                    {uploading ? <Loader2 className="animate-spin" /> : <Plus size={24} />}
                    {uploading ? 'Uploading...' : 'Add Data'}
                    {!uploading && <ChevronDown size={20} style={{ marginLeft: 'auto', transform: showModeMenu ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }} />}
                  </button>

                  {showModeMenu && (
                      <div className="glass-panel" style={{
                          position: 'absolute', 
                          top: '100%', 
                          marginTop: '12px', 
                          width: '100%',
                          background: 'rgba(30, 30, 40, 0.95)',
                          backdropFilter: 'blur(12px)',
                          border: '1px solid rgba(255,255,255,0.15)',
                          borderRadius: '16px',
                          overflow: 'hidden',
                          zIndex: 100,
                          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                          display: 'flex', 
                          flexDirection: 'column',
                          animation: 'fadeIn 0.2s ease-out'
                      }}>
                          <button 
                              onClick={() => { setCleanMode(false); setShowModeMenu(false); fileInputRef.current?.click(); }}
                              style={{ 
                                  padding: '16px', 
                                  cursor: 'pointer', 
                                  background: 'transparent',
                                  color: 'var(--text-primary)',
                                  width: '100%',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  textAlign: 'left',
                                  transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                               <div style={{ background: 'rgba(255,255,255,0.1)', padding: '10px', borderRadius: '10px', display: 'flex' }}>
                                  <Plus size={18}/> 
                               </div>
                               <div>
                                   <div style={{ fontWeight: 600, fontSize: '15px' }}>Standard Add</div>
                                   <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Simply upload your CSV</div>
                               </div>
                          </button>
                          
                          <div style={{ height: '1px', background: 'rgba(255,255,255,0.08)', margin: '0 16px' }}></div>

                           <button 
                              onClick={() => { setCleanMode(true); setShowModeMenu(false); fileInputRef.current?.click(); }}
                              style={{ 
                                  padding: '16px', 
                                  cursor: 'pointer', 
                                  background: 'transparent',
                                  color: 'var(--text-primary)',
                                  width: '100%',
                                  border: 'none',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '12px',
                                  textAlign: 'left',
                                  transition: 'background 0.2s'
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                              <div style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa', padding: '10px', borderRadius: '10px', display: 'flex' }}>
                                  <Database size={18} /> 
                              </div>
                              <div>
                                  <div style={{ fontWeight: 600, fontSize: '15px' }}>Clean & Add</div>
                                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>AI cleans & fixes formatting</div>
                              </div>
                          </button>
                      </div>
                  )}
              </div>
          </div>

          {error && (
            <div style={{ marginTop: '24px', color: 'var(--error)', background: 'rgba(239, 68, 68, 0.1)', padding: '12px 20px', borderRadius: '8px', fontSize: '14px' }}>
              {error}
            </div>
          )}
       </div>
    </div>
  );
};

export default Home;
