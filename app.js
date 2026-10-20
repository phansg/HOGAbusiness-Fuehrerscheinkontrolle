import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  serverTimestamp,
  arrayUnion,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

/* =========================================================
   1. FIREBASE CONFIG EINTRAGEN
   ========================================================= */
const firebaseConfig = {
  apiKey: "TEXTBLOCKER",
  authDomain: "TEXTBLOCKER",
  projectId: "TEXTBLOCKER",
  storageBucket: "TEXTBLOCKER",
  messagingSenderId: "TEXTBLOCKER",
  appId: "TEXTBLOCKER",
  measurementId: "TEXTBLOCKER"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const $=id=>document.getElementById(id); const employeeView=$("employee-view"),managerLoginView=$("manager-login-view"),managerView=$("manager-view");
let codeReader=null,cachedPins=[],editingPin=null;
function show(v){[employeeView,managerLoginView,managerView].forEach(x=>x.classList.add("hidden"));v.classList.remove("hidden")}
function msg(el,text,type="success"){el.textContent=text;el.className=`message ${type}`;el.classList.remove("hidden")}
function clearMsg(el){el.textContent="";el.className="message hidden"}
const norm=v=>String(v||"").trim(); const validPin=p=>/^\d{5}$/.test(p);
function toDate(v){if(!v)return null;if(v.toDate)return v.toDate();const d=new Date(v);return isNaN(d)?null:d}
function fmt(v,dateOnly=false){const d=toDate(v);return d?d.toLocaleString("de-DE",dateOnly?{day:"2-digit",month:"2-digit",year:"numeric"}:{}):"-"}
function addMonths(d,n){if(!d)return null;const x=new Date(d);const day=x.getDate();x.setDate(1);x.setMonth(x.getMonth()+Number(n));const last=new Date(x.getFullYear(),x.getMonth()+1,0).getDate();x.setDate(Math.min(day,last));return x}
function statusOf(d){if(d.active===false)return {key:"inactive",label:"Inaktiv",next:null};const last=toDate(d.lastCheckAt);if(!last)return {key:"notChecked",label:"Noch nicht geprüft",next:null};const next=addMonths(last,d.checkIntervalMonths||6),today=new Date();today.setHours(0,0,0,0);const diff=Math.ceil((next-today)/86400000);if(diff<0)return {key:"overdue",label:"Überfällig",next};if(diff<=30)return {key:"dueSoon",label:"Bald fällig",next};return {key:"current",label:"Aktuell",next}}
function intervalLabel(n){return ({1:"Monatlich",3:"Quartalsweise",6:"Halbjährlich",12:"Jährlich"})[Number(n)]||`${n} Monate`}

$("showManagerLoginBtn").onclick=()=>{clearMsg($("loginMessage"));show(managerLoginView)};$("backToEmployeeBtn").onclick=()=>show(employeeView);
$("managerLoginBtn").onclick=async()=>{clearMsg($("loginMessage"));try{await signInWithEmailAndPassword(auth,$("managerEmail").value.trim(),$("managerPassword").value)}catch(e){console.error(e);msg($("loginMessage"),"Login fehlgeschlagen. Bitte E-Mail und Passwort prüfen.","error")}};
$("forgotPasswordBtn").onclick=async()=>{const e=$("managerEmail").value.trim();if(!e)return msg($("loginMessage"),"Bitte zuerst die E-Mail-Adresse eintragen.","error");try{await sendPasswordResetEmail(auth,e);msg($("loginMessage"),"Eine E-Mail zum Zurücksetzen des Passworts wurde versendet.")}catch(err){console.error(err);msg($("loginMessage"),"Die Passwort-E-Mail konnte nicht versendet werden.","error")}};
$("logoutBtn").onclick=async()=>{await signOut(auth);show(employeeView)};$("helpBtn").onclick=()=>window.open("Bedienungsanleitung_Fuehrerscheinkontrolle.pdf","_blank","noopener");onAuthStateChanged(auth,async u=>{if(u){show(managerView);await loadPins()}});

$("startScanBtn").onclick=async()=>{clearMsg($("employeeMessage"));const entered=norm($("pinInput").value);if(!validPin(entered))return msg($("employeeMessage"),"Bitte geben Sie eine gültige 5-stellige PIN ein.","error");const ref=doc(db,"licensePins",entered),snap=await getDoc(ref);if(!snap.exists()||snap.data().active===false)return msg($("employeeMessage"),"Diese PIN ist nicht bekannt oder nicht aktiv. Bitte wenden Sie sich an die Verwaltung.","error");$("scannerBox").classList.remove("hidden");try{if(!codeReader)codeReader=new ZXing.BrowserMultiFormatReader();await codeReader.decodeFromVideoDevice(null,"qr-reader",async result=>{if(!result)return;if(norm(result.getText())!==entered)return msg($("employeeMessage"),"Der gescannte Code passt nicht zur eingegebenen PIN.","error");codeReader.reset();$("scannerBox").classList.add("hidden");await updateDoc(ref,{lastCheckAt:serverTimestamp(),checkCount:(snap.data().checkCount||0)+1,checks:arrayUnion({checkedAt:new Date().toISOString()})});$("pinInput").value="";msg($("employeeMessage"),"Vielen Dank. Die Führerscheinkontrolle wurde erfolgreich bestätigt.")})}catch(e){console.error(e);msg($("employeeMessage"),"Die Kamera konnte nicht geöffnet werden. Bitte Kamerazugriff erlauben.","error")}};
$("cancelScanBtn").onclick=()=>{if(codeReader)codeReader.reset();$("scannerBox").classList.add("hidden")};

function resetForm(){editingPin=null;$("driverFormTitle").textContent="Fahrer anlegen";$("saveDriverBtn").textContent="Fahrer anlegen";$("cancelEditBtn").classList.add("hidden");["firstNameInput","lastNameInput","emailInput","mobileInput","newPinInput"].forEach(id=>$(id).value="");$("newPinInput").disabled=false;$("intervalInput").value="6";$("activeInput").checked=true;clearMsg($("pinMessage"))}
$("cancelEditBtn").onclick=resetForm;
$("saveDriverBtn").onclick=async()=>{clearMsg($("pinMessage"));const pin=norm($("newPinInput").value),first=norm($("firstNameInput").value),last=norm($("lastNameInput").value);if(!first||!last)return msg($("pinMessage"),"Bitte Vor- und Nachname eintragen.","error");if(!validPin(pin))return msg($("pinMessage"),"Bitte eine 5-stellige PIN eingeben.","error");const ref=doc(db,"licensePins",pin);if(!editingPin&&(await getDoc(ref)).exists())return msg($("pinMessage"),"Diese PIN ist bereits vorhanden.","error");const data={pin,firstName:first,lastName:last,email:norm($("emailInput").value),mobile:norm($("mobileInput").value),checkIntervalMonths:Number($("intervalInput").value),active:$("activeInput").checked,updatedAt:serverTimestamp()};const wasEditing=Boolean(editingPin);try{if(wasEditing)await updateDoc(ref,data);else await setDoc(ref,{...data,createdAt:serverTimestamp(),lastCheckAt:null,checkCount:0,checks:[]});resetForm();await loadPins();msg($("pinMessage"),wasEditing?"Fahrer wurde aktualisiert.":"Fahrer wurde angelegt.")}catch(e){console.error(e);msg($("pinMessage"),"Fahrer konnte nicht gespeichert werden.","error")}};

async function loadPins(){const snap=await getDocs(query(collection(db,"licensePins"),orderBy("pin","asc")));cachedPins=[];snap.forEach(x=>cachedPins.push({...x.data(),pin:x.id}));render();fillQr()}
function fillQr(){const sel=$("qrPinSelect"),old=sel.value;sel.innerHTML="";cachedPins.forEach(d=>{const o=document.createElement("option");o.value=d.pin;o.textContent=`${[d.firstName,d.lastName].filter(Boolean).join(" ")||"Unzugeordnet"} · ${d.pin}`;sel.appendChild(o)});if([...sel.options].some(o=>o.value===old))sel.value=old;drawQr()}
function render(){const term=norm($("searchInput").value).toLowerCase(),filter=$("statusFilter").value;let total=0,current=0,due=0,over=0;cachedPins.forEach(d=>{const s=statusOf(d);if(d.active!==false)total++;if(s.key==="current")current++;if(s.key==="dueSoon")due++;if(s.key==="overdue")over++});$("statTotal").textContent=total;$("statCurrent").textContent=current;$("statDueSoon").textContent=due;$("statOverdue").textContent=over;const body=$("pinTableBody");body.innerHTML="";cachedPins.filter(d=>{const s=statusOf(d),hay=[d.firstName,d.lastName,d.email,d.mobile,d.pin].join(" ").toLowerCase();return(!term||hay.includes(term))&&(filter==="all"||s.key===filter)}).forEach(d=>{const s=statusOf(d),tr=document.createElement("tr"),name=[d.firstName,d.lastName].filter(Boolean).join(" ")||"Stammdaten ergänzen";tr.innerHTML=`<td><strong>${esc(name)}</strong>${!d.firstName?'<div class="muted">Bestand aus V0.1</div>':''}</td><td class="contact">${esc(d.email||"-")}<div class="muted">${esc(d.mobile||"")}</div></td><td>${esc(d.pin)}</td><td>${intervalLabel(d.checkIntervalMonths||6)}</td><td>${fmt(d.lastCheckAt,true)}</td><td>${s.next?fmt(s.next,true):"-"}</td><td><span class="badge ${s.key}">${s.label}</span></td><td><div class="actions"></div></td>`;const actions=tr.querySelector(".actions"),edit=document.createElement("button");edit.className="secondary-btn";edit.textContent="Bearbeiten";edit.onclick=()=>editDriver(d);const del=document.createElement("button");del.className="danger-btn";del.textContent="Löschen";del.onclick=async()=>{if(confirm(`Soll ${name} (${d.pin}) wirklich gelöscht werden?`)){await deleteDoc(doc(db,"licensePins",d.pin));await loadPins()}};actions.append(edit,del);body.appendChild(tr)})}
function esc(v){const x=document.createElement("div");x.textContent=String(v??"");return x.innerHTML}
function editDriver(d){editingPin=d.pin;$("driverFormTitle").textContent="Fahrer bearbeiten";$("saveDriverBtn").textContent="Änderungen speichern";$("cancelEditBtn").classList.remove("hidden");$("firstNameInput").value=d.firstName||"";$("lastNameInput").value=d.lastName||"";$("emailInput").value=d.email||"";$("mobileInput").value=d.mobile||"";$("newPinInput").value=d.pin;$("newPinInput").disabled=true;$("intervalInput").value=String(d.checkIntervalMonths||6);$("activeInput").checked=d.active!==false;window.scrollTo({top:managerView.offsetTop,behavior:"smooth"})}
$("searchInput").oninput=render;$("statusFilter").onchange=render;$("qrPinSelect").onchange=drawQr;
function drawQr(){const pin=$("qrPinSelect").value,box=document.querySelector(".qr-preview");box.innerHTML='<canvas id="qrCanvas"></canvas><div id="qrLabel" class="qr-label"></div>';if(!pin){$("qrLabel").textContent="Kein Fahrer vorhanden";return}if(typeof bwipjs==="undefined"){$("qrLabel").textContent="Code-Bibliothek wurde nicht geladen.";return}bwipjs.toCanvas("qrCanvas",{bcid:"datamatrix",text:pin,scale:6,paddingwidth:0,paddingheight:0,includetext:false});const d=cachedPins.find(x=>x.pin===pin),name=d?[d.firstName,d.lastName].filter(Boolean).join(" "):"";$("qrLabel").textContent=`${name?name+" · ":""}PIN: ${pin}`}
$("downloadCsvBtn").onclick=()=>{const rows=[["Vorname","Nachname","E-Mail","Mobiltelefon","PIN","Prüfintervall","Letzte Prüfung","Nächste Prüfung","Status","Anzahl Prüfungen","Aktiv"]];cachedPins.forEach(d=>{const s=statusOf(d);rows.push([d.firstName||"",d.lastName||"",d.email||"",d.mobile||"",d.pin,intervalLabel(d.checkIntervalMonths||6),fmt(d.lastCheckAt),s.next?fmt(s.next):"",s.label,d.checkCount||0,d.active===false?"Nein":"Ja"])});const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(";")).join("\n"),blob=new Blob(["\ufeff"+csv],{type:"text/csv;charset=utf-8;"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download=`fuehrerscheinkontrolle_${new Date().toISOString().slice(0,10)}.csv`;a.click();URL.revokeObjectURL(url)};
