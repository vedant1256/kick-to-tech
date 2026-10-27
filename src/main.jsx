import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import jsQR from 'jsqr';
import { Camera, Download, FileUp, ShieldCheck, ScanLine, Search, X, Users, Check, AlertTriangle, Smartphone, RotateCcw } from 'lucide-react';
import './styles.css';
import './actions.css';
import PEOPLE from './people.json';

const KICK_TO_TECH_PREFIX = '<kick to tech>';
const encodePerson = (p) => `${KICK_TO_TECH_PREFIX}|id=${p.id}|name=${p.name}|mobile=${p.mobile}${p.email ? `|email=${p.email}` : ''}`;
const decodePerson = (raw) => {
  if (!raw.startsWith(`${KICK_TO_TECH_PREFIX}|`)) return null;
  const fields = Object.fromEntries(raw.slice(KICK_TO_TECH_PREFIX.length + 1).split('|').map(part => { const [key, ...value] = part.split('='); return [key, value.join('=')]; }));
  return fields.id && fields.name && fields.sig ? { id: fields.id, name: fields.name, mobile: fields.mobile || '', email: fields.email || '', payload: raw, signature: fields.sig } : null;
};
const signedPayload = async (person) => { const response = await fetch('/api/qr', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: person.id }) }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'QR signing is not configured.'); return body.payload; };
const roundedQR = async (value, size = 700) => {
  const qr = QRCode.create(value, { errorCorrectionLevel: 'M' });
  const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d'); const margin = Math.round(size * .08); const cell = (size - margin * 2) / qr.modules.size;
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.fillStyle = '#151817';
  for (let row = 0; row < qr.modules.size; row++) for (let col = 0; col < qr.modules.size; col++) if (qr.modules.get(row, col)) {
    const x = margin + col * cell, y = margin + row * cell, r = Math.max(1.5, cell * .28);
    ctx.beginPath(); ctx.roundRect(x + .35, y + .35, cell - .7, cell - .7, r); ctx.fill();
  }
  return canvas.toDataURL('image/png');
};
const qrCard = async (person) => {
  const canvas = document.createElement('canvas'); canvas.width = 1200; canvas.height = 1500; const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#f4f6f1'; ctx.fillRect(0, 0, 1200, 1500); ctx.fillStyle = '#151817'; ctx.fillRect(0, 0, 1200, 235); ctx.fillStyle = '#c8ff3d'; ctx.fillRect(0, 235, 1200, 14);
  const logo = new Image(); logo.src = '/kick-to-tech-logo.jpg'; await new Promise(resolve => { logo.onload = resolve; logo.onerror = resolve; });
  if (logo.complete && logo.naturalWidth) { ctx.drawImage(logo, 72, 62, 108, 108); }
  ctx.fillStyle = '#fff'; ctx.font = '700 37px Space Grotesk, Arial'; ctx.fillText('KICK TO TECH', 220, 112); ctx.fillStyle = '#c8ff3d'; ctx.font = '700 29px Space Grotesk, Arial'; ctx.fillText('VERIFY.ID', 220, 157);
  ctx.fillStyle = '#6c756d'; ctx.font = '700 24px Space Grotesk, Arial'; ctx.letterSpacing = '3px'; ctx.fillText('ONE-TIME REFRESHMENT PASS', 72, 330); ctx.letterSpacing = '0px';
  const qrImage = new Image(); qrImage.src = await roundedQR(await signedPayload(person), 860); await new Promise(resolve => { qrImage.onload = resolve; }); ctx.fillStyle = '#fff'; ctx.fillRect(170, 375, 860, 860); ctx.drawImage(qrImage, 170, 375, 860, 860);
  ctx.fillStyle = '#151817'; ctx.font = '700 48px Space Grotesk, Arial'; ctx.fillText(person.name, 72, 1315);
  if (person.seat) {
    ctx.fillStyle = '#1e3a8a'; ctx.font = '700 23px Courier New, monospace'; ctx.fillText(person.seat, 72, 1360);
    ctx.fillStyle = '#6c756d'; ctx.font = '500 22px Inter, Arial'; ctx.fillText(`ID / ${person.id.padStart(3, '0')}    +91 ${person.mobile}`, 72, 1400);
  } else {
    ctx.fillStyle = '#6c756d'; ctx.font = '500 25px Inter, Arial'; ctx.fillText(`ID / ${person.id.padStart(3, '0')}    +91 ${person.mobile}`, 72, 1380);
  }
  ctx.fillStyle = '#7da900'; ctx.font = '700 22px Space Grotesk, Arial'; ctx.fillText('SCAN ONLY AT REFRESHMENT COUNTER', 72, 1445);
  return canvas.toDataURL('image/png');
};
const readScanned = () => JSON.parse(localStorage.getItem('qr-scanned-once') || '{}');

function ReflectiveCard({ person, onClose }) {
  const isRejected = Boolean(person.isAlreadyScanned);
  return <div className="modal-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className={`id-modal ${isRejected ? 'is-rejected' : ''}`}>
    <button className="icon-button close" onClick={onClose} aria-label="Close"><X size={18}/></button>
    {isRejected ? <div className="rejected"><AlertTriangle size={44} color="#d25347"/><h2 style={{color:'#d25347',margin:'12px 0 6px 0'}}>ACCESS DENIED</h2><p style={{fontWeight:'700',color:'#151817',margin:'0 0 8px 0'}}>Refreshment Already Redeemed</p><p style={{fontSize:'13px',color:'#6c756d',lineHeight:'1.5'}}>This Refreshment pass for <strong>{person.name}</strong> (ID #{person.id}) was already scanned and redeemed. Second scan is strictly blocked.</p>{person.scannedAt&&<span style={{display:'inline-block',background:'#fee',color:'#d25347',padding:'6px 12px',borderRadius:'4px',fontSize:'11px',marginTop:'18px',fontWeight:'700'}}>Redeemed at: {new Date(person.scannedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'})}</span>}</div> : <>
      <div className="id-top"><span>REFRESHMENT PASS</span><span className="valid"><Check size={14}/> REDEEMED</span></div>
      <div className="id-content"><div className="avatar">{person.name.split(' ').map(x=>x[0]).slice(0,2).join('')}</div><div><p className="eyebrow">IDENTITY RECORD #{person.id.padStart(3,'0')}</p><h2>{person.name}</h2><p className="mobile">+91 {person.mobile}</p>{person.email&&<p className="mobile" style={{fontSize:'12px',opacity:0.85}}>{person.email}</p>}{person.seat&&<p style={{fontSize:'12px',fontWeight:'700',color:'#1e40af',fontFamily:'monospace',marginTop:'4px'}}>{person.seat}</p>}</div></div>
      <div className="id-grid"><div><small>STATUS</small><strong>Valid & Redeemed</strong></div><div><small>RECORD TYPE</small><strong>Refreshment</strong></div><div><small>VERIFIED AT</small><strong>{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</strong></div></div>
      <div className="id-footer"><ShieldCheck size={18}/> One-time refreshment verification complete <button className="cancel-button" onClick={onClose}>Done</button></div>
    </>}
  </div></div>;
}

function AddUserModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({ id: '', name: '', email: '', mobile: '' }); const [busy, setBusy] = useState(false); const [message, setMessage] = useState('');
  const submit = async (event) => { event.preventDefault(); setBusy(true); setMessage(''); try { const res = await onSubmit(form); if (res?.mail?.sent) { setMessage('User saved! Verification QR pass emailed.'); setTimeout(onClose, 900); } else if (res?.mail?.skipped) { setMessage(`User saved! (No email sent: ${res.mail.reason})`); setTimeout(onClose, 2500); } else if (res?.mail?.error) { setMessage(`User saved! Note: Email not sent: ${res.mail.error}`); setBusy(false); } else { onClose(); } } catch (error) { setMessage(error.message); setBusy(false); } };
  return <div className="modal-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose()}}><form className="add-modal" onSubmit={submit}><button type="button" className="icon-button close" onClick={onClose} aria-label="Close"><X size={18}/></button><p className="kicker">DATA ENTRY</p><h2>Add user</h2><p className="modal-copy">Add a new member to the access list.</p><label>User ID<input required value={form.id} onChange={e=>setForm({...form,id:e.target.value})}/></label><label>Full name<input required value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label><label>Email address<input type="email" placeholder="name@example.com" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></label><label>Mobile number<input required inputMode="numeric" value={form.mobile} onChange={e=>setForm({...form,mobile:e.target.value})}/></label>{message&&<p className="error">{message}</p>}<button className="primary" disabled={busy}>{busy?'Saving…':'Save user'}</button></form></div>;
}

function ScanDataModal({ scan, onClose }) {
  const [showData, setShowData] = useState(false);
  return <div className="modal-backdrop" onClick={event=>{if(event.target===event.currentTarget)onClose()}}><div className="scan-data-modal"><button className="icon-button close" onClick={onClose} aria-label="Close"><X size={18}/></button><div className="scan-data-icon"><AlertTriangle size={24}/></div><p className="kicker">SCAN PREVIEW ONLY</p><h2>No matching user data</h2><p className="modal-copy">This scan was not verified, stored, or counted. You can inspect the decoded text locally.</p><button className="secondary" onClick={()=>setShowData(true)}>Show data</button>{showData&&<pre className="raw-scan">{scan.raw}</pre>}</div></div>;
}

function App() {
  const [mode, setMode] = useState('scan'); const [person, setPerson] = useState(null); const [scanData, setScanData] = useState(null); const [query, setQuery] = useState(''); const [people, setPeople] = useState(PEOPLE); const [addOpen, setAddOpen] = useState(false); const [downloadTargetId, setDownloadTargetId] = useState('');
  const [camera, setCamera] = useState(false); const [error, setError] = useState(''); const videoRef = useRef(null); const streamRef = useRef(null);
  const isScanningActiveRef = useRef(false); const isProcessingRef = useRef(false);

  useEffect(() => {
    fetch('/api/users')
      .then(response => response.ok ? response.json() : null)
      .then(body => { if (body?.users?.length) setPeople(body.users); })
      .catch(() => {});
  }, []);

  const filtered = people.filter(p => `${p.name} ${p.mobile} ${p.id} ${p.email || ''}`.toLowerCase().includes(query.toLowerCase()));
  const downloadTarget = people.find(p => p.id === downloadTargetId);

  useEffect(() => {
    localStorage.removeItem('qr-scanned-once');
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPerson(null);
        setAddOpen(false);
        setScanData(null);
        isProcessingRef.current = false;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  const resetAllScans = async () => {
    if (!window.confirm('Reset all scan records? All current users will get a fresh chance to scan.')) return;
    try {
      const res = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'reset' }) });
      if (res.ok) { localStorage.removeItem('qr-scanned-once'); alert('All scan records have been reset! All attendees can now be scanned again.'); }
    } catch { alert('Could not reset scans.'); }
  };
  const stopCamera = () => { isScanningActiveRef.current = false; if (streamRef.current) { streamRef.current.getTracks().forEach(t=>t.stop()); streamRef.current=null; } if (videoRef.current) { videoRef.current.srcObject=null; } setCamera(false); };
  const openCamera = async () => { setError(''); isProcessingRef.current = false; try { const stream = await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}}); streamRef.current=stream; isScanningActiveRef.current = true; setCamera(true); setTimeout(()=>{if(videoRef.current){videoRef.current.srcObject=stream; videoRef.current.play();}},50); } catch { setError('Camera permission is needed to scan. You can also upload a QR image below.'); } };
  useEffect(() => { let timer; const canvas = document.createElement('canvas'); const context = canvas.getContext('2d', { willReadFrequently: true }); const tick = () => { if (!isScanningActiveRef.current) return; const video = videoRef.current; if (video && video.readyState >= 2 && video.videoWidth) { canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0, canvas.width, canvas.height); const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'attemptBoth' }); if (result?.data) { isScanningActiveRef.current = false; stopCamera(); handleCode(result.data); return; } } if (isScanningActiveRef.current) timer = requestAnimationFrame(tick); }; if (camera) { isScanningActiveRef.current = true; timer = requestAnimationFrame(tick); } return () => { isScanningActiveRef.current = false; if (timer) cancelAnimationFrame(timer); }; }, [camera, people]);
  const handleCode = async (raw) => { if (isProcessingRef.current) return; isProcessingRef.current = true; try { const data = decodePerson(raw); const found = data && people.find(p => p.id === String(data.id)); if(!data || !found){ setError(''); setScanData({ raw }); return; } const response = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...found, payload: data.payload, signature: data.signature }) }); const result = await response.json().catch(() => ({})); if(response.status === 403){ setScanData({ raw }); return; } if(result.status === 'already-scanned'){ setPerson({ ...found, isAlreadyScanned: true, scannedAt: result.scannedAt }); } else { setPerson({ ...found, isAlreadyScanned: false, scannedAt: result.scannedAt }); } } catch { setPerson(null); isProcessingRef.current = false; } };
  const upload = (file) => { if(!file)return; const img=new Image(); img.onload=()=>{const c=document.createElement('canvas'); c.width=img.width;c.height=img.height;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);const out=jsQR(ctx.getImageData(0,0,c.width,c.height).data,c.width,c.height); if(out)handleCode(out.data); else setError('No QR code found in that image.');}; img.src=URL.createObjectURL(file); };
  const downloadQR = async (p) => { try { const data=await qrCard(p); const a=document.createElement('a');a.href=data;a.download=`verify-${p.id}-${p.name.replaceAll(' ','-').toLowerCase()}.png`;a.click(); } catch { setError('QR signing is not configured yet.'); } };
  const downloadAll = async () => { if (!people.length) return; try { const zip=new JSZip(); for(const p of people){const data=await qrCard(p);zip.file(`verify-${p.id}-${p.name.replaceAll(' ','-').toLowerCase()}.png`,data.split(',')[1],{base64:true});} const blob=await zip.generateAsync({type:'blob'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='verify-all-qr-cards.zip';a.click(); } catch { setError('QR signing is not configured yet.'); } };
  const addUser = async ({ id, name, mobile, email }) => { const response = await fetch('/api/users', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, name, mobile, email }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Could not save user.'); setPeople(current => [...current, body.user]); return body; };
  return <><header className="nav"><div className="brand"><img src="/kick-to-tech-logo.jpg" alt="Kick to Tech logo"/><span>KICK TO TECH <span className="lime">VERIFY.ID</span></span></div><nav><button className={mode==='scan'?'active':''} onClick={()=>setMode('scan')}>Scan ID</button></nav><div className="nav-status"><span className="dot"/> SYSTEM ONLINE</div></header><div className="top-actions"><button className="primary compact" disabled={!people.length} onClick={downloadAll}><Download size={16}/> Download all QR codes</button><div className="specific-download"><select aria-label="Select user QR" value={downloadTargetId} onChange={e=>setDownloadTargetId(e.target.value)}><option value="">Select a user QR</option>{people.map(p=><option key={p.id} value={p.id}>{p.id} · {p.name}</option>)}</select><button className="secondary" disabled={!downloadTarget} onClick={()=>downloadQR(downloadTarget)}><Download size={15}/> Download user QR</button></div><button className="secondary" onClick={()=>setAddOpen(true)}><Users size={15}/> Add user</button><button className="secondary" onClick={resetAllScans} title="Reset scan history"><RotateCcw size={15}/> Reset scans</button></div>
  <main>{mode==='scan' ? <section className="scan-page"><div className="scan-copy"><p className="kicker">ONE-TIME ACCESS VERIFICATION</p><h1>SCAN.<br/><em>VERIFY.</em><br/>MOVE.</h1><p className="lead">Instantly validate a member ID. One scan per person, with every detail kept clear and accountable.</p><div className="trust"><ShieldCheck size={18}/><span>Privacy-first verification<br/><small>Scanned IDs cannot be checked twice.</small></span></div></div><div className="scanner-wrap"><div className="scanner-card"><div className="scanner-head"><span>READY TO SCAN</span><span className="live"><span className="dot"/> LIVE</span></div>{camera ? <div className="video-box"><video ref={videoRef} muted playsInline/><div className="scan-frame"><i/><i/><i/><i/></div><button className="stop" onClick={stopCamera}>Stop camera</button></div> : <div className="scan-empty"><ScanLine size={44}/><strong>Point your camera<br/>at a Verify ID QR</strong><span>Camera permission will be requested</span></div>}<button className="primary large" onClick={camera?stopCamera:openCamera}><Camera size={18}/>{camera?'Stop scanning':'Open camera'}</button><label className="upload"><FileUp size={17}/> Upload QR image<input type="file" accept="image/*" onChange={e=>upload(e.target.files[0])}/></label>{error&&<p className="error">{error}</p>}</div><p className="scanner-note"><Smartphone size={15}/> Works with any phone camera</p></div></section> : <section className="roster-page"><div className="page-heading"><div><p className="kicker">DIRECTORY / {people.length} ACTIVE RECORDS</p><h1>QR <em>ROSTER.</em></h1><p>Generate, download, and manage one-time verification codes for every user.</p></div><button className="primary" onClick={downloadAll}><Download size={17}/> Download all QR codes</button></div><div className="toolbar"><div className="search"><Search size={17}/><input placeholder="Search name, mobile, or ID" value={query} onChange={e=>setQuery(e.target.value)}/></div><span>{filtered.length} showing</span></div><div className="people-grid">{filtered.map(p=><article className="person-card" key={p.id}><div className="qr-mini"><img src={URL.createObjectURL(new Blob([]))} onError={e=>{roundedQR(encodePerson(p),220).then(x=>e.currentTarget.src=x)}} alt="QR code"/></div><div className="person-info"><span className="person-id">ID / {p.id.padStart(3,'0')}</span><h3>{p.name}</h3>{p.seat&&<p style={{fontSize:'11px',fontWeight:'700',color:'#1e40af',fontFamily:'monospace',background:'#eff6ff',padding:'3px 8px',borderRadius:'4px',margin:'2px 0 6px 0',display:'inline-block'}}>{p.seat}</p>}<p>+91 {p.mobile}</p>{p.email&&<p style={{fontSize:'12px',color:'#7c857d',marginTop:'-10px',marginBottom:'12px'}}>{p.email}</p>}<button className="download-link" onClick={()=>downloadQR(p)}><Download size={15}/> Download QR</button></div></article>)}</div></section>}</main>{person&&<ReflectiveCard person={person} onClose={()=>{setPerson(null); isProcessingRef.current = false;}}/>} {scanData&&<ScanDataModal scan={scanData} onClose={()=>{setScanData(null); isProcessingRef.current = false;}}/>} {addOpen&&<AddUserModal onClose={()=>setAddOpen(false)} onSubmit={addUser}/>}<footer><span>VERIFY.ID / MEMBER ACCESS SYSTEM</span><span>BUILD WHAT'S NEXT <span className="lime">●</span></span></footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);





