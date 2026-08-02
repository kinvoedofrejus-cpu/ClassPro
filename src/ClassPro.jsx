import React, { useState, useEffect, useRef } from "react";
import {
  Home, FileText, Users, MessageCircle, User, Search, Bell, LayoutDashboard,
  Plus, X, Send, ChevronLeft, Heart, MessageSquare, Star, GraduationCap,
  BookOpen, Award, School, Paperclip, Mic, Square, Play, Pause, Image as ImageIcon, File as FileIcon,
  Settings, Shield, Trash2, BellOff, LogOut, MoreVertical, Pin as PinIcon, Edit2,
  Camera, Download, Flag, Loader2, LogIn, UserPlus, Check, CheckCheck, ShieldCheck, ShieldAlert, AlertTriangle,
  Ban, KeyRound, HelpCircle, ScrollText, ShieldQuestion, Megaphone, UserX, UserCheck, Crown
} from "lucide-react";

/* ---------------------------------------------------------------
   CLASSPRO — réseau social des enseignants du Bénin
   Palette moderne : indigo #4F3FF0 (primaire) | corail #FF5C4D (accent)
                      fond lavande clair #F3F2FB | cartes blanches
   Polices : Sora (titres) | Inter (texte)

   NOTE PROTOTYPE : ceci est un prototype front-end sans vrai serveur.
   Les comptes / mots de passe sont stockés tels quels dans le stockage
   partagé de l'artefact (pas de hachage, pas de vraie sécurité) — à
   remplacer par un vrai backend avant toute mise en production.
----------------------------------------------------------------*/

const DATA_KEY = "classpro-data-v2";
const ACCOUNTS_KEY = "classpro-accounts-v2";
const SESSION_KEY = "classpro-session-v2";
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 Mo par pièce jointe
const MAX_ATTACHMENTS = 4; // pièces jointes max par publication
const PAGE_SIZE = 6;

const MATIERES = ["Primaire", "Mathématiques", "SVT", "Français", "Histoire-Géo", "Anglais", "Physique-Chimie", "EPS"];
const NIVEAUX = ["Primaire", "6e", "5e", "4e", "3e", "2nde", "1ère", "Terminale"];

const BENIN = {
  "Alibori": ["Banikoara", "Gogounou", "Kandi", "Karimama", "Malanville", "Ségbana"],
  "Atacora": ["Boukombé", "Cobly", "Kérou", "Kouandé", "Matéri", "Natitingou", "Péhunco", "Tanguiéta", "Toucountouna"],
  "Atlantique": ["Abomey-Calavi", "Allada", "Kpomassè", "Ouidah", "Sô-Ava", "Toffo", "Tori-Bossito", "Zè"],
  "Borgou": ["Bembèrèkè", "Kalalé", "N'Dali", "Nikki", "Parakou", "Pèrèrè", "Sinendé", "Tchaourou"],
  "Collines": ["Bantè", "Dassa-Zoumè", "Glazoué", "Ouèssè", "Savalou", "Savè"],
  "Couffo": ["Aplahoué", "Djakotomey", "Dogbo", "Klouékanmè", "Lalo", "Toviklin"],
  "Donga": ["Bassila", "Copargo", "Djougou", "Ouaké"],
  "Littoral": ["Cotonou"],
  "Mono": ["Athiémé", "Bopa", "Comè", "Grand-Popo", "Houéyogbé", "Lokossa"],
  "Ouémé": ["Adjarra", "Adjohoun", "Aguégués", "Akpro-Missérété", "Avrankou", "Bonou", "Dangbo", "Porto-Novo", "Sèmè-Podji"],
  "Plateau": ["Adja-Ouèrè", "Ifangni", "Kétou", "Pobè", "Sakété"],
  "Zou": ["Abomey", "Agbangnizoun", "Bohicon", "Covè", "Djidja", "Ouinhi", "Zagnanado", "Za-Kpota", "Zogbodomey"],
};
const DEPARTEMENTS = Object.keys(BENIN);

const REPORT_REASONS = ["Spam ou publicité", "Contenu abusif ou injurieux", "Fausse information", "Contenu hors sujet", "Autre"];

const SECURITY_QUESTIONS = [
  "Quel est le nom de votre premier établissement ?",
  "Quel est le prénom de votre enseignant préféré ?",
  "Quelle est votre ville de naissance ?",
  "Quel est le nom de votre premier élève ou de votre première classe ?",
];

function uid(prefix = "id") {
  return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Compression réelle d'image (redimensionnement + réencodage JPEG) — utile sur connexions
// mobiles limitées. Retombe sur le fichier original si la compression échoue ou si le format
// ne s'y prête pas (ex. GIF animé).
function compressImage(file, { maxDim = 1280, quality = 0.72 } = {}) {
  return new Promise((resolve) => {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, originalSize: file.size, compressedSize: file.size }));
      return;
    }
    const img = new Image();
    const reader = new FileReader();
    reader.onload = () => { img.src = reader.result; };
    reader.onerror = () => readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, originalSize: file.size, compressedSize: file.size }));
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) { height = Math.round((height * maxDim) / width); width = maxDim; }
        else { width = Math.round((width * maxDim) / height); height = maxDim; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const compressedSize = Math.round((dataUrl.length * 3) / 4);
      resolve({ dataUrl, originalSize: file.size, compressedSize });
    };
    img.onerror = () => readFileAsDataUrl(file).then((dataUrl) => resolve({ dataUrl, originalSize: file.size, compressedSize: file.size }));
    reader.readAsDataURL(file);
  });
}

async function fileToAttachment(file) {
  if (file.type.startsWith("image/")) {
    const { dataUrl, originalSize, compressedSize } = await compressImage(file);
    return { type: "image", name: file.name, dataUrl, originalSize, compressedSize };
  }
  return { type: "file", name: file.name };
}

function downloadJSON(filename, obj) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function AttachmentPreview({ attachment }) {
  if (!attachment) return null;
  if (attachment.type === "image") {
    return <img src={attachment.dataUrl} alt={attachment.name} className="attach-img" />;
  }
  return (
    <div className="attach-file">
      <FileIcon size={14} />
      <span>{attachment.name}</span>
    </div>
  );
}

function AttachmentsPreview({ attachments }) {
  const list = attachments || [];
  if (list.length === 0) return null;
  if (list.length === 1) return <AttachmentPreview attachment={list[0]} />;
  return (
    <div className={`attach-grid count-${Math.min(list.length, 4)}`}>
      {list.map((a, i) => (
        <div key={i} className="attach-grid-item">
          <AttachmentPreview attachment={a} />
        </div>
      ))}
    </div>
  );
}

function VoiceBubble({ duration }) {
  const [playing, setPlaying] = useState(false);
  return (
    <button className="voice-bubble" onClick={() => setPlaying((p) => !p)}>
      {playing ? <Pause size={14} /> : <Play size={14} />}
      <span className="voice-wave">▂▄▆▃▅▇▂▄▅▃</span>
      <span className="voice-duration">{duration}s</span>
    </button>
  );
}

function VerifBadge({ status }) {
  if (status === "verifie") return <span className="verified" title="Enseignant vérifié"><ShieldCheck size={12} /></span>;
  if (status === "attente") return <span className="verif-pending" title="Vérification en attente"><ShieldAlert size={12} /></span>;
  return null;
}

/* ---------------- Données de démonstration ---------------- */

const seedAccounts = () => ({
  acc_admin: { id: "acc_admin", identifiant: "fondateur@classpro.bj", password: "admin1234", name: "Fondateur ClassPro", matiere: "Primaire", niveau: "—", etablissement: "Direction ClassPro", departement: "Littoral", ville: "Cotonou", anciennete: "—", avatar: null, verification: "verifie", verifDoc: null, createdAt: Date.now(), blockedIds: [], securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: "classpro", role: "admin", suspended: false },
  acc_fabrice: { id: "acc_fabrice", identifiant: "fabrice.dossou@demo.bj", password: "demo1234", name: "Fabrice Dossou", matiere: "SVT", niveau: "Terminale D", etablissement: "Lycée Coulibaly", departement: "Littoral", ville: "Cotonou", anciennete: "9 ans", avatar: null, verification: "verifie", verifDoc: null, createdAt: Date.now(), blockedIds: [], securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: "coulibaly", role: "membre", suspended: false },
  acc_clarisse: { id: "acc_clarisse", identifiant: "clarisse.adjovi@demo.bj", password: "demo1234", name: "Clarisse Adjovi", matiere: "Français", niveau: "6e", etablissement: "EPP Centre Parakou", departement: "Borgou", ville: "Parakou", anciennete: "12 ans", avatar: null, verification: "verifie", verifDoc: null, createdAt: Date.now(), blockedIds: [], securityQuestion: SECURITY_QUESTIONS[2], securityAnswer: "parakou", role: "membre", suspended: false },
  acc_ismael: { id: "acc_ismael", identifiant: "ismael.gbaguidi@demo.bj", password: "demo1234", name: "Ismaël Gbaguidi", matiere: "Mathématiques", niveau: "CM2", etablissement: "EPP Zogbo", departement: "Atlantique", ville: "Abomey-Calavi", anciennete: "1 an", avatar: null, verification: "attente", verifDoc: { name: "attestation-service.pdf" }, createdAt: Date.now(), blockedIds: [], securityQuestion: SECURITY_QUESTIONS[1], securityAnswer: "monsieur agbo", role: "membre", suspended: false },
  acc_solange: { id: "acc_solange", identifiant: "solange.houndjo@demo.bj", password: "demo1234", name: "Solange Houndjo", matiere: "Anglais", niveau: "3e", etablissement: "CEG 1 Natitingou", departement: "Atacora", ville: "Natitingou", anciennete: "2 ans", avatar: null, verification: "aucune", verifDoc: null, createdAt: Date.now(), blockedIds: [], securityQuestion: SECURITY_QUESTIONS[3], securityAnswer: "cm1 a", role: "membre", suspended: false },
});

const seedData = () => ({
  publications: [
    { id: "p1", authorId: "acc_fabrice", author: "Fabrice Dossou", matiere: "SVT", niveau: "Terminale D", ville: "Cotonou", text: "Je partage ma séquence sur la génétique, avec fiche TD et corrigé. N'hésitez pas si vous voulez l'adapter à votre classe.", likes: 0, likedBy: [], commentsList: [
      { id: "pc1", authorId: "acc_clarisse", author: "Clarisse Adjovi", text: "Merci, je la garde pour ma progression de Terminale !" },
      { id: "pc2", authorId: "acc_ismael", author: "Ismaël Gbaguidi", text: "Le corrigé est-il aussi disponible en version élève ?" },
    ], date: "2026-07-25" },
    { id: "p2", authorId: "acc_clarisse", author: "Clarisse Adjovi", matiere: "Français", niveau: "6e", ville: "Parakou", text: "Petite astuce pour faire aimer la dictée aux élèves de 6e : je la transforme en jeu d'équipe. Résultats bluffants depuis 2 semaines !", likes: 0, likedBy: [], commentsList: [
      { id: "pc3", authorId: "acc_fabrice", author: "Fabrice Dossou", text: "Excellente idée, je vais tester ça avec ma classe de 6e B." },
    ], date: "2026-07-24" },
    { id: "p3", authorId: "acc_ismael", author: "Ismaël Gbaguidi", matiere: "Mathématiques", niveau: "CM2", ville: "Abomey-Calavi", text: "Quelqu'un a-t-il une progression annuelle pour le CM2 conforme au dernier programme ? Je débute cette année.", likes: 0, likedBy: [], commentsList: [], date: "2026-07-23" },
  ],
  groupes: [
    { id: "g1", name: "Profs de SVT du Bénin", desc: "Partage de séquences, sorties pédagogiques, préparation aux examens.", visibility: "public", memberIds: ["acc_fabrice"], adminId: "acc_fabrice", admin: "Fabrice Dossou", coAdminIds: [], joinRequests: [], posts: [] },
    { id: "g2", name: "Direction d'école primaire", desc: "Échanges entre directeurs et directrices sur la gestion d'établissement.", visibility: "prive", memberIds: ["acc_clarisse"], adminId: "acc_clarisse", admin: "Clarisse Adjovi", coAdminIds: [], joinRequests: [], posts: [] },
    { id: "g3", name: "Nouveaux enseignants Bénin", desc: "Entraide pour les premières années d'enseignement.", visibility: "public", memberIds: ["acc_ismael"], adminId: "acc_ismael", admin: "Ismaël Gbaguidi", coAdminIds: [], joinRequests: [], posts: [
      { id: "gp1", authorId: "acc_ismael", author: "Ismaël Gbaguidi", text: "Bienvenue à tous les nouveaux ! Partagez vos questions ici.", attachments: [], likes: 0, likedBy: [], date: "2026-07-22" },
    ] },
    { id: "g4", name: "Préparer le BEPC & Bac", desc: "Sujets, corrigés, méthodo pour accompagner les élèves aux examens.", visibility: "public", memberIds: ["acc_fabrice"], adminId: "acc_fabrice", admin: "Fabrice Dossou", coAdminIds: [], joinRequests: [], posts: [] },
  ],
  notifications: [
    { id: "n1", text: "Clarisse Adjovi a commenté votre publication.", time: "il y a 1h", read: true, to: "acc_fabrice" },
    { id: "n2", text: "Nouveau document dans le groupe Profs de SVT du Bénin.", time: "il y a 3h", read: true, to: "acc_fabrice" },
    { id: "n3", text: "Vous avez reçu un nouveau message d'Ismaël Gbaguidi.", time: "hier", read: true, to: "acc_clarisse" },
  ],
  threads: [
    { id: "t1", participantIds: ["acc_fabrice", "acc_ismael"], lastRead: {}, messages: [
      { id: "m1", authorId: "acc_ismael", author: "Ismaël Gbaguidi", text: "Bonjour, merci pour la fiche partagée hier !", time: "09:02", ts: Date.now() - 100000 },
      { id: "m2", authorId: "acc_fabrice", author: "Fabrice Dossou", text: "Avec plaisir, dites-moi si vous avez besoin du corrigé aussi.", time: "09:10", ts: Date.now() - 90000 },
    ] },
    { id: "t2", participantIds: ["acc_fabrice", "acc_clarisse"], lastRead: {}, messages: [
      { id: "m3", authorId: "acc_clarisse", author: "Clarisse Adjovi", text: "On peut échanger sur la méthode de dictée en équipe si ça t'intéresse.", time: "hier", ts: Date.now() - 900000 },
    ] },
  ],
  reports: [],
  annonces: [
    { id: "an1", title: "Bienvenue sur ClassPro", text: "Ce réseau est encore en construction : vos retours sont précieux pour l'améliorer.", date: "2026-07-20", pinned: true },
  ],
});

function useDebouncedSave(data) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      try { await window.storage.set(DATA_KEY, JSON.stringify(data), true); }
      catch (e) { console.error("Erreur de sauvegarde", e); }
    }, 400);
    return () => clearTimeout(t);
  }, [data]);
}

function useDebouncedSaveAccounts(accounts) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const t = setTimeout(async () => {
      try { await window.storage.set(ACCOUNTS_KEY, JSON.stringify(accounts), true); }
      catch (e) { console.error("Erreur de sauvegarde des comptes", e); }
    }, 400);
    return () => clearTimeout(t);
  }, [accounts]);
}

function Card({ children, i = 0, className = "" }) {
  return (
    <div className={`note ${className}`}>
      {children}
    </div>
  );
}

function Badge({ children, tone = "ink" }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

const AVATAR_GRADIENTS = [
  ["#4F3FF0", "#7C6BFF"], ["#FF5C4D", "#FF8A6B"], ["#1E8A4C", "#4FBE7E"],
  ["#E8452F", "#FF8A6B"], ["#3A2BC4", "#4F3FF0"], ["#C9932E", "#F0C05A"],
];
function Avatar({ name = "", size = "", avatar = null }) {
  if (avatar) {
    return <div className={`avatar ${size} has-img`}><img src={avatar} alt={name} /></div>;
  }
  const initials = name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const idx = name.split("").reduce((s, c) => s + c.charCodeAt(0), 0) % AVATAR_GRADIENTS.length;
  const [c1, c2] = AVATAR_GRADIENTS[idx];
  return (
    <div className={`avatar ${size}`} style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
      {initials || "?"}
    </div>
  );
}

function EmptyState({ label }) {
  return <div className="empty"><p>{label}</p></div>;
}

function Modal({ title, onClose, children }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="icon-btn" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

function LoadMoreButton({ shown, total, onClick }) {
  if (shown >= total) return null;
  return (
    <button className="load-more-btn" onClick={onClick}>
      Charger plus ({total - shown} restants)
    </button>
  );
}

function ReportModal({ title, onClose, onSubmit }) {
  const [reason, setReason] = useState(REPORT_REASONS[0]);
  const [details, setDetails] = useState("");
  const [sent, setSent] = useState(false);
  const submit = () => {
    onSubmit({ reason, details });
    setSent(true);
    setTimeout(onClose, 1100);
  };
  return (
    <Modal title={title} onClose={onClose}>
      {sent ? (
        <p className="muted">Merci, votre signalement a bien été transmis pour modération.</p>
      ) : (
        <>
          <div className="form-row">
            <label>Motif</label>
            <select value={reason} onChange={(e) => setReason(e.target.value)}>
              {REPORT_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          <div className="form-row">
            <label>Détails (facultatif)</label>
            <textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Précisez si besoin…" />
          </div>
          <button className="btn-primary" onClick={submit}><Flag size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Envoyer le signalement</button>
        </>
      )}
    </Modal>
  );
}

/* ---------------- Screens ---------------- */

function CommentSection({ post, addComment, updateComment, deleteComment, profile }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const list = post.commentsList || [];

  const submit = () => {
    if (!text.trim()) return;
    addComment(post.id, { id: uid("c"), authorId: profile.id, author: profile.name, text });
    setText("");
  };

  const startEdit = (c) => { setEditId(c.id); setEditText(c.text); };
  const saveEdit = () => {
    if (!editText.trim()) return;
    updateComment(post.id, editId, editText);
    setEditId(null); setEditText("");
  };

  return (
    <div className="comment-section">
      <button className="icon-text" onClick={() => setOpen((o) => !o)}><MessageSquare size={14} /> {list.length}</button>
      {open && (
        <div className="comment-list">
          {list.map((c) => (
            <div key={c.id} className="comment-item">
              {editId === c.id ? (
                <div className="comment-edit-row">
                  <input value={editText} onChange={(e) => setEditText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveEdit()} />
                  <button className="icon-btn tiny" onClick={saveEdit}><Check size={11} /></button>
                  <button className="icon-btn tiny" onClick={() => setEditId(null)}><X size={11} /></button>
                </div>
              ) : (
                <>
                  <span className="comment-author">{c.author}</span>
                  <span className="comment-text">{c.text}{c.edited && <span className="comment-edited"> (modifié)</span>}</span>
                </>
              )}
              {c.authorId === profile.id && editId !== c.id && (
                <div className="comment-actions">
                  <button onClick={() => startEdit(c)}><Edit2 size={10} /></button>
                  <button onClick={() => deleteComment(post.id, c.id)}><Trash2 size={10} /></button>
                </div>
              )}
            </div>
          ))}
          <div className="comment-input-row">
            <input placeholder="Écrire un commentaire…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
            <button className="icon-btn primary tiny" onClick={submit}><Send size={12} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeScreen({ data, profile, accounts, addPublication, likePost, addComment, updateComment, deleteComment, onOpenChat, updatePublication, deletePublication, addReport, toggleBlock }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState("");
  const [posting, setPosting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const fileRef = useRef(null);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [editId, setEditId] = useState(null);
  const [editText, setEditText] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [reportPostId, setReportPostId] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachError("");
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setAttachError(`Maximum ${MAX_ATTACHMENTS} pièces jointes par publication.`);
      e.target.value = "";
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setAttachError(`Fichier trop volumineux (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo) : ${tooBig.name}.`);
      e.target.value = "";
      return;
    }
    setCompressing(true);
    const built = await Promise.all(files.map((f) => fileToAttachment(f)));
    setAttachments((prev) => [...prev, ...built]);
    setCompressing(false);
    e.target.value = "";
  };

  const removeAttachment = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if ((!text.trim() && attachments.length === 0) || posting) return;
    setPosting(true);
    await addPublication({
      id: uid("p"), authorId: profile.id, author: profile.name, matiere: profile.matiere, niveau: profile.niveau,
      ville: profile.ville, text, likes: 0, likedBy: [], commentsList: [], date: new Date().toISOString().slice(0, 10),
      attachments,
    });
    setText(""); setAttachments([]); setPosting(false);
    setOpen(false);
  };

  const startEdit = (p) => {
    setEditId(p.id);
    setEditText(p.text);
    setMenuOpenId(null);
  };

  const saveEdit = () => {
    if (!editText.trim()) return;
    updatePublication(editId, { text: editText, edited: true });
    setEditId(null);
    setEditText("");
  };

  const confirmDelete = (id) => {
    setMenuOpenId(null);
    deletePublication(id);
    setConfirmDeleteId(null);
  };

  const visiblePublications = data.publications.filter((p) => !(profile.blockedIds || []).includes(p.authorId) && !(p.authorId && accounts?.[p.authorId]?.suspended));
  const list = visiblePublications.slice(0, visible);

  return (
    <div className="screen">
      <div className="hero">
        <p className="hero-eyebrow">Salle des profs</p>
        <h1 className="hero-title">Bonjour {profile.name.split(" ")[0]}</h1>
        <button className="chat-fab" onClick={() => setOpen(true)}>
          <Plus size={18} /> Publier quelque chose
        </button>
      </div>
      {(data.annonces || []).filter((a) => a.pinned).length > 0 && (
        <div className="board" style={{ paddingBottom: 0 }}>
          {(data.annonces || []).filter((a) => a.pinned).map((a) => (
            <div key={a.id} className="annonce-card">
              <p className="annonce-title"><Megaphone size={13} style={{ verticalAlign: "-2px", marginRight: 5 }} />{a.title}</p>
              <p className="muted small">{a.text}</p>
            </div>
          ))}
        </div>
      )}
      <div className="board">
        {list.map((p, i) => (
          <Card key={p.id} i={i}>
            <div className="post-head-row">
              <div className="post-author-row">
                <Avatar name={p.author} avatar={p.authorAvatar} />
                <div>
                  <h4>
                    {p.author}
                    <VerifBadge status={p.authorVerification} />
                    {accounts?.[p.authorId]?.role === "admin" && <span className="admin-badge" title="Administrateur"><Crown size={12} /></span>}
                  </h4>
                  <p className="meta">{p.matiere} · {p.ville} · {p.date}{p.edited && " · modifié"}</p>
                </div>
              </div>
              {p.authorId === profile.id ? (
                <div className="post-menu-wrap">
                  <button className="icon-btn tiny" onClick={() => { setMenuOpenId(menuOpenId === p.id ? null : p.id); setConfirmDeleteId(null); }}><MoreVertical size={14} /></button>
                  {menuOpenId === p.id && (
                    <div className="post-menu">
                      <button onClick={() => startEdit(p)}>Modifier</button>
                      {confirmDeleteId === p.id ? (
                        <button className="danger" onClick={() => confirmDelete(p.id)}>Confirmer ?</button>
                      ) : (
                        <button className="danger" onClick={() => setConfirmDeleteId(p.id)}>Supprimer</button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="post-menu-wrap">
                  <button className="icon-btn tiny" onClick={() => setMenuOpenId(menuOpenId === p.id ? null : p.id)}><MoreVertical size={14} /></button>
                  {menuOpenId === p.id && (
                    <div className="post-menu">
                      <button onClick={() => { onOpenChat(p.authorId, p.author); setMenuOpenId(null); }}>Contacter</button>
                      <button className="danger" onClick={() => { setReportPostId(p.id); setMenuOpenId(null); }}><Flag size={12} style={{ verticalAlign: "-1px", marginRight: 5 }} />Signaler</button>
                      <button className="danger" onClick={() => { toggleBlock(p.authorId); setMenuOpenId(null); }}><Ban size={12} style={{ verticalAlign: "-1px", marginRight: 5 }} />Bloquer {p.author}</button>
                    </div>
                  )}
                </div>
              )}
            </div>
            {editId === p.id ? (
              <div className="edit-post-block">
                <textarea rows={3} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div className="edit-post-actions">
                  <button className="chip small" onClick={() => setEditId(null)}>Annuler</button>
                  <button className="chip small active" onClick={saveEdit}>Enregistrer</button>
                </div>
              </div>
            ) : (
              <p className="muted post-body">{p.text}</p>
            )}
            {(p.attachments?.length > 0 || p.attachment) && <AttachmentsPreview attachments={p.attachments || (p.attachment ? [p.attachment] : [])} />}
            <div className="post-foot">
              <button className={`icon-text ${(p.likedBy || []).includes(profile.id) ? "liked" : ""}`} onClick={() => likePost(p.id)}>
                <Heart size={14} fill={(p.likedBy || []).includes(profile.id) ? "currentColor" : "none"} /> {(p.likedBy || []).length}
              </button>
              <CommentSection post={p} addComment={addComment} updateComment={updateComment} deleteComment={deleteComment} profile={profile} />
              {p.authorId !== profile.id && (
                <button className="icon-text" onClick={() => onOpenChat(p.authorId, p.author)}><MessageCircle size={14} /> Contacter</button>
              )}
            </div>
          </Card>
        ))}
        {visiblePublications.length === 0 && <EmptyState label="Aucune publication pour le moment." />}
      </div>
      <LoadMoreButton shown={visible} total={visiblePublications.length} onClick={() => setVisible((v) => v + PAGE_SIZE)} />
      {open && (
        <Modal title="Nouvelle publication" onClose={() => setOpen(false)}>
          <div className="form-row">
            <label>Votre message</label>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Partagez une ressource, une question, une astuce…" />
          </div>
          {attachError && <p className="error-text">{attachError}</p>}
          {attachments.length > 0 && (
            <div className="attach-preview-grid">
              {attachments.map((a, i) => (
                <div key={i} className="attach-preview-chip">
                  <AttachmentPreview attachment={a} />
                  <button className="icon-btn tiny" onClick={() => removeAttachment(i)}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="form-row">
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }} onChange={handleFile} />
            <button className="chip small" disabled={compressing || attachments.length >= MAX_ATTACHMENTS} onClick={() => fileRef.current?.click()}>
              <Paperclip size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} /> {compressing ? "Compression…" : `Joindre images ou PDF (max ${MAX_ATTACHMENTS}, 3 Mo chacun)`}
            </button>
          </div>
          <button className="btn-primary" disabled={posting || compressing} onClick={submit}>
            {posting ? <><Loader2 size={14} className="spin" style={{ verticalAlign: "-2px", marginRight: 6 }} />Publication…</> : "Publier"}
          </button>
        </Modal>
      )}
      {reportPostId && (
        <ReportModal
          title="Signaler cette publication"
          onClose={() => setReportPostId(null)}
          onSubmit={({ reason, details }) => addReport({ targetType: "publication", targetId: reportPostId, reason, details })}
        />
      )}
    </div>
  );
}

function MentionText({ text, names }) {
  if (!text) return null;
  const list = (names || []).filter(Boolean).sort((a, b) => b.length - a.length);
  if (list.length === 0) return <>{text}</>;
  const pattern = new RegExp(`@(${list.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})\\b`, "g");
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push(<span key={match.index} className="mention-tag">@{match[1]}</span>);
    lastIndex = match.index + match[0].length;
  }
  parts.push(text.slice(lastIndex));
  return <>{parts}</>;
}

function GroupFeed({ group, profile, accounts, addGroupPost, likeGroupPost, deleteGroupPost, toggleBlock }) {
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [attachError, setAttachError] = useState("");
  const [posting, setPosting] = useState(false);
  const [compressing, setCompressing] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionAnchor, setMentionAnchor] = useState(0);
  const fileRef = useRef(null);
  const scrollRef = useRef(null);
  const textareaRef = useRef(null);
  const isMember = (group.memberIds || []).includes(profile.id);
  const groupMembers = (group.memberIds || []).map((id) => accounts[id]).filter(Boolean);
  const mentionCandidates = groupMembers.filter((m) => m.id !== profile.id);
  const memberNames = groupMembers.map((m) => m.name);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setText(val);
    const cursor = e.target.selectionStart;
    const uptoCursor = val.slice(0, cursor);
    const m = uptoCursor.match(/(?:^|\s)@([^\s@]*)$/);
    if (m) {
      setMentionOpen(true);
      setMentionQuery(m[1]);
      setMentionAnchor(cursor - m[1].length - 1);
    } else {
      setMentionOpen(false);
    }
  };

  const insertMention = (member) => {
    const before = text.slice(0, mentionAnchor);
    const after = text.slice(mentionAnchor + 1 + mentionQuery.length);
    const newText = `${before}@${member.name} ${after}`;
    setText(newText);
    setMentionOpen(false);
    setMentionQuery("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = before.length + member.name.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pos, pos);
      }
    });
  };

  const mentionSuggestions = mentionOpen
    ? mentionCandidates.filter((m) => m.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  const handleFile = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setAttachError("");
    if (attachments.length + files.length > MAX_ATTACHMENTS) {
      setAttachError(`Maximum ${MAX_ATTACHMENTS} pièces jointes.`);
      e.target.value = "";
      return;
    }
    const tooBig = files.find((f) => f.size > MAX_FILE_BYTES);
    if (tooBig) {
      setAttachError(`Fichier trop volumineux (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo) : ${tooBig.name}.`);
      e.target.value = "";
      return;
    }
    setCompressing(true);
    const built = await Promise.all(files.map((f) => fileToAttachment(f)));
    setAttachments((prev) => [...prev, ...built]);
    setCompressing(false);
    e.target.value = "";
  };

  const removeAttachment = (idx) => setAttachments((prev) => prev.filter((_, i) => i !== idx));

  const submit = async () => {
    if ((!text.trim() && attachments.length === 0) || posting) return;
    setPosting(true);
    const mentionedIds = mentionCandidates.filter((m) => text.includes(`@${m.name}`)).map((m) => m.id);
    await addGroupPost(group.id, {
      id: uid("gp"), authorId: profile.id, author: profile.name, text, attachments,
      replyTo: replyTo ? { id: replyTo.id, author: replyTo.author, text: replyTo.text } : null,
      mentionedIds,
      likes: 0, likedBy: [], date: new Date().toISOString().slice(0, 10),
    });
    setText(""); setAttachments([]); setPosting(false); setReplyTo(null);
  };

  const posts = (group.posts || []).filter((p) => !(profile.blockedIds || []).includes(p.authorId) && !(p.authorId && accounts?.[p.authorId]?.suspended));

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [posts.length]);

  return (
    <div className="group-feed">
      <div className="board group-thread" ref={scrollRef}>
        {posts.length === 0 && <EmptyState label="Aucune publication dans ce groupe pour le moment." />}
        {posts.map((p, i) => (
          <Card key={p.id} i={i}>
            <div className="post-head-row">
              <div className="post-author-row">
                <Avatar name={p.author} size="sm" avatar={p.authorAvatar} />
                <div>
                  <h4>{p.author}</h4>
                  <p className="meta">{p.date}</p>
                </div>
              </div>
              {p.authorId === profile.id ? (
                <button className="icon-btn tiny" onClick={() => deleteGroupPost(group.id, p.id)}><Trash2 size={13} /></button>
              ) : (
                <button className="icon-btn tiny" title={`Bloquer ${p.author}`} onClick={() => toggleBlock(p.authorId)}><Ban size={13} /></button>
              )}
            </div>
            {p.replyTo && (
              <div className="quote-block">
                <p className="quote-author">{p.replyTo.author}</p>
                <p className="quote-text">{p.replyTo.text}</p>
              </div>
            )}
            <p className="muted post-body"><MentionText text={p.text} names={memberNames} /></p>
            {(p.attachments?.length > 0 || p.attachment) && <AttachmentsPreview attachments={p.attachments || (p.attachment ? [p.attachment] : [])} />}
            <div className="post-foot">
              <button className={`icon-text ${(p.likedBy || []).includes(profile.id) ? "liked" : ""}`} onClick={() => likeGroupPost(group.id, p.id)}>
                <Heart size={14} fill={(p.likedBy || []).includes(profile.id) ? "currentColor" : "none"} /> {(p.likedBy || []).length}
              </button>
              {isMember && p.authorId !== profile.id && (
                <button className="icon-text" onClick={() => setReplyTo(p)}><MessageSquare size={14} /> Répondre</button>
              )}
            </div>
          </Card>
        ))}
      </div>
      {isMember ? (
        <div className="group-composer">
          {replyTo && (
            <div className="reply-preview">
              <div>
                <p className="quote-author">Réponse à {replyTo.author}</p>
                <p className="quote-text">{replyTo.text}</p>
              </div>
              <button className="icon-btn tiny" onClick={() => setReplyTo(null)}><X size={12} /></button>
            </div>
          )}
          {attachError && <p className="error-text">{attachError}</p>}
          {attachments.length > 0 && (
            <div className="attach-preview-grid">
              {attachments.map((a, i) => (
                <div key={i} className="attach-preview-chip">
                  <AttachmentPreview attachment={a} />
                  <button className="icon-btn tiny" onClick={() => removeAttachment(i)}><X size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="group-composer-row" style={{ position: "relative" }}>
            {mentionOpen && mentionSuggestions.length > 0 && (
              <div className="mention-dropdown">
                {mentionSuggestions.map((m) => (
                  <button key={m.id} className="mention-option" onClick={() => insertMention(m)}>
                    <Avatar name={m.name} avatar={m.avatar} size="sm" /> {m.name}
                  </button>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,.pdf" multiple style={{ display: "none" }} onChange={handleFile} />
            <button className="icon-btn" disabled={compressing || attachments.length >= MAX_ATTACHMENTS} onClick={() => fileRef.current?.click()}><Paperclip size={16} /></button>
            <textarea ref={textareaRef} rows={1} placeholder="Écrire au groupe… (@ pour mentionner)" value={text} onChange={handleTextChange} />
            <button className="icon-btn primary" disabled={posting || compressing} onClick={submit}><Send size={16} /></button>
          </div>
        </div>
      ) : (
        <p className="muted small" style={{ padding: "8px 4px" }}>Rejoignez le groupe pour publier et partager des documents ici.</p>
      )}
    </div>
  );
}

function GroupMembersModal({ group, accounts, profile, isMainAdmin, isCoAdmin, onClose, toggleCoAdmin, removeMember, approveJoinRequest, rejectJoinRequest, addMemberDirect }) {
  const members = (group.memberIds || []).map((id) => accounts[id]).filter(Boolean);
  const requesters = (group.joinRequests || []).map((id) => accounts[id]).filter(Boolean);
  const [addQuery, setAddQuery] = useState("");
  const [linkCopied, setLinkCopied] = useState(false);
  const canManage = isMainAdmin || isCoAdmin;
  const inviteLink = `${window.location.origin}${window.location.pathname}?rejoindre=${group.id}`;
  const candidates = canManage && addQuery.trim()
    ? Object.values(accounts).filter((a) => !(group.memberIds || []).includes(a.id) && a.name.toLowerCase().includes(addQuery.trim().toLowerCase())).slice(0, 6)
    : [];

  const copyLink = async () => {
    try { await navigator.clipboard.writeText(inviteLink); } catch (e) { /* copie manuelle possible via le champ */ }
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <Modal title="Membres du groupe" onClose={onClose}>
      {canManage && (
        <>
          <p className="muted small" style={{ fontWeight: 700, marginBottom: 6 }}>Inviter par lien</p>
          <div className="invite-link-row">
            <input readOnly value={inviteLink} onFocus={(e) => e.target.select()} />
            <button className="chip small" onClick={copyLink}>{linkCopied ? "Copié !" : "Copier"}</button>
          </div>
          <p className="muted small" style={{ fontWeight: 700, margin: "12px 0 6px" }}>Ajouter directement un enseignant</p>
          <input placeholder="Chercher par nom…" value={addQuery} onChange={(e) => setAddQuery(e.target.value)} style={{ width: "100%", border: "1.5px solid var(--border)", borderRadius: 10, padding: "8px 10px", fontFamily: "'Inter'", fontSize: 13, outline: "none", marginBottom: 6 }} />
          {candidates.map((a) => (
            <div key={a.id} className="member-row">
              <div className="post-author-row"><Avatar name={a.name} avatar={a.avatar} size="sm" /><span>{a.name}</span></div>
              <button className="chip small active" onClick={() => { addMemberDirect(group.id, a.id); setAddQuery(""); }}><Plus size={12} style={{ verticalAlign: "-2px" }} />Ajouter</button>
            </div>
          ))}
        </>
      )}
      {requesters.length > 0 && canManage && (
        <>
          <p className="muted small" style={{ fontWeight: 700, margin: "12px 0 6px" }}>Demandes en attente</p>
          {requesters.map((a) => (
            <div key={a.id} className="member-row">
              <div className="post-author-row"><Avatar name={a.name} avatar={a.avatar} size="sm" /><span>{a.name}</span></div>
              <div style={{ display: "flex", gap: 6 }}>
                <button className="icon-btn tiny primary" onClick={() => approveJoinRequest(group.id, a.id)}><Check size={12} /></button>
                <button className="icon-btn tiny" onClick={() => rejectJoinRequest(group.id, a.id)}><X size={12} /></button>
              </div>
            </div>
          ))}
        </>
      )}
      <p className="muted small" style={{ fontWeight: 700, margin: "10px 0 6px" }}>{members.length} membre{members.length > 1 ? "s" : ""}</p>
      {members.map((a) => {
        const isGroupAdmin = group.adminId === a.id;
        const isGroupCoAdmin = (group.coAdminIds || []).includes(a.id);
        return (
          <div key={a.id} className="member-row">
            <div className="post-author-row">
              <Avatar name={a.name} avatar={a.avatar} size="sm" />
              <span>{a.name} {isGroupAdmin && <span className="admin-badge" title="Administrateur"><Crown size={11} /></span>}{isGroupCoAdmin && <Badge tone="cork">Co-admin</Badge>}</span>
            </div>
            {a.id !== profile.id && !isGroupAdmin && (
              <div style={{ display: "flex", gap: 6 }}>
                {isMainAdmin && (
                  <button className="chip small" onClick={() => toggleCoAdmin(group.id, a.id)}>{isGroupCoAdmin ? "Rétrograder" : "Promouvoir"}</button>
                )}
                {(isMainAdmin || (isCoAdmin && !isGroupCoAdmin)) && (
                  <button className="chip small danger" onClick={() => removeMember(group.id, a.id)}>Retirer</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </Modal>
  );
}

function GroupesScreen({ data, accounts, toggleJoin, addGroup, updateGroup, deleteGroup, profile, addGroupPost, likeGroupPost, deleteGroupPost, addReport, toggleBlock, requestJoinGroup, approveJoinRequest, rejectJoinRequest, toggleCoAdmin, removeMember, addMemberDirect, openGroupId, onOpenGroupHandled }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [form, setForm] = useState({ name: "", desc: "", visibility: "public" });
  const [editForm, setEditForm] = useState({ name: "", desc: "" });
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false);
  const [reportGroupOpen, setReportGroupOpen] = useState(false);
  const [visible, setVisible] = useState(PAGE_SIZE);

  useEffect(() => {
    if (openGroupId && data.groupes.some((g) => g.id === openGroupId)) {
      setSelected(openGroupId);
      onOpenGroupHandled?.();
    }
  }, [openGroupId]);

  const filtered = data.groupes.filter((g) => (g.name + g.desc).toLowerCase().includes(q.toLowerCase()));
  const list = filtered.slice(0, visible);

  const submitCreate = () => {
    if (!form.name.trim()) return;
    addGroup({ id: uid("g"), name: form.name, desc: form.desc, visibility: form.visibility, memberIds: [profile.id], adminId: profile.id, admin: profile.name, coAdminIds: [], joinRequests: [], posts: [] });
    setForm({ name: "", desc: "", visibility: "public" });
    setOpen(false);
  };

  if (selected) {
    const g = data.groupes.find((x) => x.id === selected);
    if (!g) { setSelected(null); return null; }
    const isAdmin = g.adminId === profile.id;
    const isCoAdmin = (g.coAdminIds || []).includes(profile.id);
    const isMember = (g.memberIds || []).includes(profile.id);
    const isPrivate = g.visibility === "prive";
    const hasRequested = (g.joinRequests || []).includes(profile.id);
    const memberCount = (g.memberIds || []).length;
    const pendingCount = (g.joinRequests || []).length;
    const submitEdit = () => {
      updateGroup(g.id, { name: editForm.name || g.name, desc: editForm.desc || g.desc });
      setSettingsOpen(false);
    };
    const joinButtonLabel = isMember ? "Membre ✓" : isPrivate ? (hasRequested ? "Demande envoyée" : "Demander à rejoindre") : "Rejoindre";
    const handleJoinClick = () => {
      if (isMember) { toggleJoin(g.id); return; }
      if (isPrivate) { if (!hasRequested) requestJoinGroup(g.id); return; }
      toggleJoin(g.id);
    };
    return (
      <div className="screen">
        <button className="back-btn" onClick={() => setSelected(null)}><ChevronLeft size={16} /> Groupes</button>
        <Card i={0}>
          <div className="group-detail-head">
            <div style={{ display: "flex", gap: 6 }}>
              <Badge tone="sage">{memberCount} membre{memberCount > 1 ? "s" : ""}</Badge>
              <Badge tone={isPrivate ? "pin" : "ink"}>{isPrivate ? "Groupe privé" : "Groupe public"}</Badge>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {(isAdmin || isCoAdmin) && (
                <button className="icon-btn" title="Membres" onClick={() => setMembersOpen(true)} style={{ position: "relative" }}>
                  <Users size={16} />
                  {pendingCount > 0 && <span className="badge-dot" style={{ border: "2px solid var(--surface)" }}>{pendingCount}</span>}
                </button>
              )}
              {isAdmin ? (
                <button className="icon-btn" onClick={() => { setEditForm({ name: g.name, desc: g.desc }); setSettingsOpen(true); setConfirmDeleteGroup(false); }}><Settings size={16} /></button>
              ) : (
                <button className="icon-btn" title="Signaler ce groupe" onClick={() => setReportGroupOpen(true)}><Flag size={15} /></button>
              )}
            </div>
          </div>
          <h4>{g.name}</h4>
          <p className="muted">{g.desc}</p>
          <p className="meta"><Shield size={12} /> Administrateur : {g.admin}{isAdmin && " (vous)"}</p>
          <button className={`chip small ${isMember ? "active" : ""}`} disabled={isPrivate && hasRequested && !isMember} onClick={handleJoinClick}>
            {joinButtonLabel}
          </button>
        </Card>
        {(!isMember && isPrivate) ? (
          <p className="muted small" style={{ padding: "0 6px" }}>Ce groupe est privé : son fil n'est visible qu'à ses membres. {hasRequested ? "Votre demande est en attente de validation." : "Envoyez une demande pour le rejoindre."}</p>
        ) : (
          <GroupFeed group={g} profile={profile} accounts={accounts} addGroupPost={addGroupPost} likeGroupPost={likeGroupPost} deleteGroupPost={deleteGroupPost} toggleBlock={toggleBlock} />
        )}
        {membersOpen && (
          <GroupMembersModal group={g} accounts={accounts} profile={profile} isMainAdmin={isAdmin} isCoAdmin={isCoAdmin} onClose={() => setMembersOpen(false)} toggleCoAdmin={toggleCoAdmin} removeMember={removeMember} approveJoinRequest={approveJoinRequest} rejectJoinRequest={rejectJoinRequest} addMemberDirect={addMemberDirect} />
        )}
        {settingsOpen && (
          <Modal title="Paramètres du groupe" onClose={() => setSettingsOpen(false)}>
            <div className="form-row">
              <label>Nom du groupe</label>
              <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="form-row">
              <label>Description</label>
              <textarea rows={3} value={editForm.desc} onChange={(e) => setEditForm({ ...editForm, desc: e.target.value })} />
            </div>
            <button className="btn-primary" onClick={submitEdit}>Enregistrer</button>
            {confirmDeleteGroup ? (
              <button className="btn-danger" onClick={() => { deleteGroup(g.id); setSettingsOpen(false); setSelected(null); }}>
                <Trash2 size={14} /> Confirmer la suppression ?
              </button>
            ) : (
              <button className="btn-danger" onClick={() => setConfirmDeleteGroup(true)}>
                <Trash2 size={14} /> Supprimer le groupe
              </button>
            )}
          </Modal>
        )}
        {reportGroupOpen && (
          <ReportModal
            title="Signaler ce groupe"
            onClose={() => setReportGroupOpen(false)}
            onSubmit={({ reason, details }) => addReport({ targetType: "groupe", targetId: g.id, reason, details })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head">
        <h2>Groupes</h2>
        <button className="icon-btn primary" onClick={() => setOpen(true)}><Plus size={18} /></button>
      </div>
      <div className="search-row">
        <Search size={16} />
        <input placeholder="Chercher un groupe…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="board">
        {list.map((g, i) => {
          const isMember = (g.memberIds || []).includes(profile.id);
          const isPrivate = g.visibility === "prive";
          const hasRequested = (g.joinRequests || []).includes(profile.id);
          const memberCount = (g.memberIds || []).length;
          return (
            <Card key={g.id} i={i}>
              <div className="click-area" onClick={() => setSelected(g.id)}>
                <div style={{ display: "flex", gap: 6 }}>
                  <Badge tone="sage">{memberCount} membre{memberCount > 1 ? "s" : ""}</Badge>
                  {isPrivate && <Badge tone="pin">Privé</Badge>}
                </div>
                <h4>{g.name}</h4>
                <p className="muted">{g.desc}</p>
              </div>
              <button
                className={`chip small ${isMember ? "active" : ""}`}
                disabled={!isMember && isPrivate && hasRequested}
                onClick={() => {
                  if (isMember) { toggleJoin(g.id); return; }
                  if (isPrivate) { if (!hasRequested) requestJoinGroup(g.id); return; }
                  toggleJoin(g.id);
                }}
              >
                {isMember ? "Membre ✓" : isPrivate ? (hasRequested ? "Demande envoyée" : "Demander à rejoindre") : "Rejoindre"}
              </button>
            </Card>
          );
        })}
        {filtered.length === 0 && <EmptyState label="Aucun groupe trouvé." />}
      </div>
      <LoadMoreButton shown={visible} total={filtered.length} onClick={() => setVisible((v) => v + PAGE_SIZE)} />
      {open && (
        <Modal title="Créer un groupe" onClose={() => setOpen(false)}>
          <div className="form-row">
            <label>Nom du groupe</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex. Profs d'Anglais Cotonou" />
          </div>
          <div className="form-row">
            <label>Description</label>
            <textarea rows={3} value={form.desc} onChange={(e) => setForm({ ...form, desc: e.target.value })} />
          </div>
          <div className="form-row">
            <label>Visibilité</label>
            <div className="filter-chips">
              <button className={`chip small ${form.visibility === "public" ? "active" : ""}`} onClick={() => setForm({ ...form, visibility: "public" })}>Public</button>
              <button className={`chip small ${form.visibility === "prive" ? "active" : ""}`} onClick={() => setForm({ ...form, visibility: "prive" })}>Privé (sur demande)</button>
            </div>
          </div>
          <p className="muted small">Vous serez administrateur de ce groupe.</p>
          <button className="btn-primary" onClick={submitCreate}>Créer le groupe</button>
        </Modal>
      )}
    </div>
  );
}

function MessagerieScreen({ data, accounts, sendMessage, profile, muteThread, clearThread, openThread, setOpenThread, pinMessage, markThreadRead, addReport, toggleBlock }) {
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [sending, setSending] = useState(false);
  const [threadSettingsOpen, setThreadSettingsOpen] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [attachError, setAttachError] = useState("");
  const [reportThreadOpen, setReportThreadOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const scrollRef = useRef(null);
  const fileRef = useRef(null);
  const recordTimer = useRef(null);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [openThread, data.threads]);

  const otherOf = (t) => {
    const otherId = (t.participantIds || []).find((id) => id !== profile.id);
    return accounts[otherId] || null;
  };

  const unreadOf = (t) => {
    const lastRead = t.lastRead?.[profile.id] || 0;
    return t.messages.filter((m) => m.authorId !== profile.id && (m.ts || 0) > lastRead).length;
  };

  if (openThread) {
    const t = data.threads.find((x) => x.id === openThread);
    if (!t) { setOpenThread(null); return null; }
    const other = otherOf(t);
    const otherLastRead = t.lastRead?.[other?.id] || 0;
    const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    const pinned = t.messages.filter((m) => m.pinned);
    const displayedMessages = searchOpen && searchQuery.trim()
      ? t.messages.filter((m) => (m.text || "").toLowerCase().includes(searchQuery.trim().toLowerCase()))
      : t.messages;

    const submit = async () => {
      if (!text.trim() || sending) return;
      setSending(true);
      await sendMessage(openThread, { id: uid("m"), authorId: profile.id, author: profile.name, text, time: now(), ts: Date.now() });
      setText("");
      setSending(false);
    };

    const handleFile = async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setAttachError("");
      if (file.size > MAX_FILE_BYTES) {
        setAttachError(`Fichier trop volumineux (max ${Math.round(MAX_FILE_BYTES / 1024 / 1024)} Mo).`);
        e.target.value = "";
        return;
      }
      setSending(true);
      const att = await fileToAttachment(file);
      await sendMessage(openThread, { id: uid("m"), authorId: profile.id, author: profile.name, time: now(), ts: Date.now(), attachment: att });
      setSending(false);
      e.target.value = "";
    };

    const startRecording = () => {
      setRecording(true);
      recordTimer.current = { start: Date.now() };
    };
    const stopRecording = async () => {
      const seconds = Math.max(1, Math.round((Date.now() - (recordTimer.current?.start || Date.now())) / 1000));
      setRecording(false);
      await sendMessage(openThread, { id: uid("m"), authorId: profile.id, author: profile.name, time: now(), ts: Date.now(), voice: seconds });
    };

    return (
      <div className="screen thread-screen">
        <div className="thread-head-row">
          <button className="back-btn" onClick={() => { setOpenThread(null); setSearchOpen(false); setSearchQuery(""); }}><ChevronLeft size={16} /> Messages</button>
          <div style={{ display: "flex", gap: 6 }}>
            <button className="icon-btn" onClick={() => { setSearchOpen((o) => !o); setSearchQuery(""); }}><Search size={16} /></button>
            <button className="icon-btn" onClick={() => { setThreadSettingsOpen(true); setConfirmClear(false); }}><MoreVertical size={16} /></button>
          </div>
        </div>
        <h3 className="sub-head">{other?.name || "Utilisateur"} {t.muted && <BellOff size={14} style={{ verticalAlign: "-2px" }} />}</h3>
        {searchOpen && (
          <div className="search-row">
            <Search size={16} />
            <input autoFocus placeholder="Rechercher dans cette conversation…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            {searchQuery && <button className="icon-btn tiny" onClick={() => setSearchQuery("")}><X size={12} /></button>}
          </div>
        )}
        {pinned.length > 0 && (
          <div className="pinned-bar">
            {pinned.map((m) => (
              <div key={m.id} className="pinned-item">
                <PinIcon size={11} />
                <span>{m.text || (m.voice ? "Message vocal" : m.attachment ? m.attachment.name : "")}</span>
                <button className="icon-btn tiny" onClick={() => pinMessage(openThread, m.id)}><X size={10} /></button>
              </div>
            ))}
          </div>
        )}
        <div className="chat-messages" ref={scrollRef}>
          {t.messages.length === 0 && <EmptyState label="Conversation vide." />}
          {searchOpen && searchQuery.trim() && displayedMessages.length === 0 && t.messages.length > 0 && <EmptyState label="Aucun message ne correspond à votre recherche." />}
          {displayedMessages.map((m) => {
            const mine = m.authorId === profile.id;
            const read = mine && (m.ts || 0) <= otherLastRead;
            return (
              <div key={m.id} className={`msg ${mine ? "mine" : ""}`}>
                <p className="msg-meta">{mine ? "Moi" : m.author} · {m.time}</p>
                {m.text && <p className="msg-text">{m.text}</p>}
                {m.attachment && <AttachmentPreview attachment={m.attachment} />}
                {m.voice && <VoiceBubble duration={m.voice} />}
                <div className="msg-foot-row">
                  <button className="msg-pin-btn" onClick={() => pinMessage(openThread, m.id)}>
                    <PinIcon size={11} /> {m.pinned ? "Désépingler" : "Épingler"}
                  </button>
                  {mine && (
                    <span className="msg-status">
                      {read ? <CheckCheck size={13} /> : <Check size={13} />}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {attachError && <p className="error-text">{attachError}</p>}
        <input ref={fileRef} type="file" accept="image/*,.pdf,.doc,.docx" style={{ display: "none" }} onChange={handleFile} />
        <div className="chat-input-row static">
          <button className="icon-btn" onClick={() => fileRef.current?.click()}><Paperclip size={16} /></button>
          {recording ? (
            <button className="icon-btn primary recording" onClick={stopRecording}><Square size={14} /></button>
          ) : (
            <>
              <input placeholder="Écrire un message…" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} />
              {text.trim() ? (
                <button className="icon-btn primary" onClick={submit} disabled={sending}>
                  {sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                </button>
              ) : (
                <button className="icon-btn primary" onClick={startRecording}><Mic size={16} /></button>
              )}
            </>
          )}
        </div>
        {threadSettingsOpen && (
          <Modal title="Paramètres de la discussion" onClose={() => setThreadSettingsOpen(false)}>
            <button className="chip settings-row" onClick={() => muteThread(openThread)}>
              <BellOff size={14} /> {t.muted ? "Réactiver les notifications" : "Mettre en sourdine"}
            </button>
            <button className="chip settings-row" onClick={() => { setThreadSettingsOpen(false); setReportThreadOpen(true); }}>
              <Flag size={14} /> Signaler {other?.name || "cette personne"}
            </button>
            <button className="chip settings-row danger" onClick={() => { setThreadSettingsOpen(false); toggleBlock(other?.id); }}>
              <Ban size={14} /> Bloquer {other?.name || "cette personne"}
            </button>
            {confirmClear ? (
              <button className="chip settings-row danger" onClick={() => { clearThread(openThread); setThreadSettingsOpen(false); setConfirmClear(false); }}>
                <Trash2 size={14} /> Confirmer le vidage ?
              </button>
            ) : (
              <button className="chip settings-row danger" onClick={() => setConfirmClear(true)}>
                <Trash2 size={14} /> Vider la conversation
              </button>
            )}
          </Modal>
        )}
        {reportThreadOpen && (
          <ReportModal
            title={`Signaler ${other?.name || "cette personne"}`}
            onClose={() => setReportThreadOpen(false)}
            onSubmit={({ reason, details }) => addReport({ targetType: "utilisateur", targetId: other?.id, reason, details })}
          />
        )}
      </div>
    );
  }

  return (
    <div className="screen">
      <div className="screen-head"><h2>Messagerie</h2></div>
      <div className="board">
        {data.threads.filter((t) => !(t.participantIds || []).some((id) => id !== profile.id && (profile.blockedIds || []).includes(id))).map((t, i) => {
          const other = otherOf(t);
          const last = t.messages[t.messages.length - 1];
          const unread = unreadOf(t);
          return (
            <Card key={t.id} i={i} className="click-area">
              <div onClick={() => { setOpenThread(t.id); markThreadRead(t.id); }} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <h4>{other?.name || "Utilisateur"}</h4>
                  <p className="muted">{last?.text || (last?.voice ? "Message vocal" : last?.attachment ? last.attachment.name : "")}</p>
                  <p className="meta">{last?.time}</p>
                </div>
                {unread > 0 && <span className="unread-dot">{unread}</span>}
              </div>
            </Card>
          );
        })}
        {data.threads.length === 0 && <EmptyState label="Aucune conversation pour le moment." />}
      </div>
    </div>
  );
}

function ProfilScreen({ profile, data, updateProfile, exportMyData, deleteAccount, onLogout }) {
  const [editOpen, setEditOpen] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const mesPublications = data.publications.filter((p) => p.authorId === profile.id);
  const groupesRejoints = data.groupes.filter((g) => (g.memberIds || []).includes(profile.id)).length;
  const totalLikes = mesPublications.reduce((sum, p) => sum + (p.likedBy?.length || 0), 0);
  const totalCommentaires = mesPublications.reduce((sum, p) => sum + (p.commentsList?.length || 0), 0);
  const documentsPartages = mesPublications.filter((p) => (p.attachments && p.attachments.length > 0) || p.attachment).length;
  const points = mesPublications.length * 5 + totalLikes * 2 + totalCommentaires;

  return (
    <div className="screen">
      <div className="screen-head"><h2>Mon profil</h2></div>
      <Card i={0}>
        <div className="post-head-row">
          <div className="post-author-row">
            <Avatar name={profile.name} avatar={profile.avatar} />
            <div>
              <h4>{profile.name} <VerifBadge status={profile.verification} /></h4>
              <Badge tone="cork">{profile.matiere}</Badge>
            </div>
          </div>
          <button className="icon-btn tiny" title="Modifier mon profil" onClick={() => setEditOpen(true)}><Edit2 size={13} /></button>
        </div>
        <p className="meta"><School size={12} /> {profile.etablissement}, {profile.ville} ({profile.departement})</p>
        <p className="meta"><GraduationCap size={12} /> {profile.niveau} · {profile.anciennete}</p>
        {profile.verification === "attente" && <p className="meta verif-pending-text"><ShieldAlert size={12} /> Vérification en attente d'examen</p>}
        {profile.pendingName && <p className="meta verif-pending-text"><ShieldQuestion size={12} /> Changement de nom en attente de validation par l'administration : « {profile.pendingName} »</p>}
      </Card>
      <h3 className="sub-head">Tableau de bord</h3>
      <div className="dash-grid">
        <div className="dash-card"><p className="dash-num">{mesPublications.length}</p><p className="dash-label">Publications</p></div>
        <div className="dash-card"><p className="dash-num">{groupesRejoints}</p><p className="dash-label">Groupes rejoints</p></div>
        <div className="dash-card"><p className="dash-num">{points}</p><p className="dash-label">Points réputation</p></div>
        <div className="dash-card"><p className="dash-num">{documentsPartages}</p><p className="dash-label">Documents partagés</p></div>
      </div>
      <h3 className="sub-head">Mes données</h3>
      <Card i={0}>
        <button className="chip settings-row" onClick={exportMyData}><Download size={14} /> Exporter mes données (JSON)</button>
        <p className="muted small" style={{ marginTop: 8 }}>La suppression du compte est disponible dans Paramètres → Compte.</p>
      </Card>
      <h3 className="sub-head">Session</h3>
      <Card i={0}>
        {confirmLogout ? (
          <button className="chip settings-row danger" onClick={onLogout}><LogOut size={14} /> Confirmer la déconnexion ?</button>
        ) : (
          <button className="chip settings-row danger" onClick={() => setConfirmLogout(true)}><LogOut size={14} /> Se déconnecter</button>
        )}
      </Card>
      {editOpen && (
        <Modal title="Modifier mon profil" onClose={() => setEditOpen(false)}>
          <ProfileForm
            initial={profile}
            submitLabel="Enregistrer"
            editMode
            onDone={(form) => { updateProfile(form); setEditOpen(false); }}
          />
        </Modal>
      )}
    </div>
  );
}

function RechercheOverlay({ accounts, data, onClose, onOpenChat, profile, toggleBlock }) {
  const [q, setQ] = useState("");
  const [matiereFilter, setMatiereFilter] = useState(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const allAccounts = Object.values(accounts).filter((a) => a.profileSearchable !== false && !(profile?.blockedIds || []).includes(a.id));
  const matieresPresentes = [...new Set(allAccounts.map((a) => a.matiere))];
  const filtered = allAccounts
    .filter((a) => (a.name + a.matiere + a.niveau + a.ville).toLowerCase().includes(q.toLowerCase()))
    .filter((a) => !matiereFilter || a.matiere === matiereFilter);
  const list = filtered.slice(0, visible);

  return (
    <div className="chat-overlay">
      <div className="chat-head">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <h3>Rechercher un enseignant</h3>
      </div>
      <div className="screen">
        <div className="search-row">
          <Search size={16} />
          <input autoFocus placeholder="Nom, matière, ville…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {matieresPresentes.length > 1 && (
          <div className="filter-chips">
            <button className={`chip small ${!matiereFilter ? "active" : ""}`} onClick={() => setMatiereFilter(null)}>Toutes matières</button>
            {matieresPresentes.map((m) => (
              <button key={m} className={`chip small ${matiereFilter === m ? "active" : ""}`} onClick={() => setMatiereFilter(m)}>{m}</button>
            ))}
          </div>
        )}
        <div className="board">
          {list.length === 0 && <EmptyState label="Aucun résultat." />}
          {list.map((a, i) => (
            <Card key={a.id} i={i}>
              <div className="post-head-row">
                <div className="post-author-row">
                  <Avatar name={a.name} avatar={a.avatar} />
                  <div>
                    <h4>{a.name} <VerifBadge status={a.verification} /></h4>
                    <p className="meta">{a.matiere} · {a.niveau} · {a.ville}</p>
                  </div>
                </div>
                {a.id !== profile?.id && (
                  <div style={{ display: "flex", gap: 6 }}>
                    <button className="icon-btn tiny primary" title="Contacter" onClick={() => onOpenChat(a.id, a.name)}><MessageCircle size={13} /></button>
                    <button className="icon-btn tiny" title="Bloquer" onClick={() => toggleBlock(a.id)}><Ban size={13} /></button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
        <LoadMoreButton shown={visible} total={filtered.length} onClick={() => setVisible((v) => v + PAGE_SIZE)} />
      </div>
    </div>
  );
}

function NotificationsOverlay({ data, onClose, profile, markNotificationsRead }) {
  useEffect(() => { markNotificationsRead(); }, []);
  const list = data.notifications.filter((n) => !n.to || n.to === profile.id);
  return (
    <div className="chat-overlay">
      <div className="chat-head">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <h3>Notifications</h3>
      </div>
      <div className="screen">
        <div className="board">
          {list.length === 0 && <EmptyState label="Aucune notification pour le moment." />}
          {list.map((n, i) => (
            <Card key={n.id} i={i} className={n.read === false ? "unread-note" : ""}>
              <p className="muted">{n.text}</p>
              <p className="meta">{n.time}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function LegalOverlay({ onClose }) {
  return (
    <div className="chat-overlay">
      <div className="chat-head">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <h3>Mentions légales</h3>
      </div>
      <div className="screen legal-screen">
        <h3 className="sub-head">Éditeur</h3>
        <Card i={0}>
          <p className="muted">ClassPro est un prototype développé pour les enseignants du Bénin. Cette version est une démonstration front-end et n'est pas encore adossée à un hébergement de production ni à une société éditrice enregistrée.</p>
        </Card>

        <h3 className="sub-head">Nature du prototype</h3>
        <Card i={0}>
          <p className="muted">Aucun serveur distant ne traite vos données à ce stade : elles sont conservées dans le stockage de cet artefact. Les mots de passe ne sont pas chiffrés, la synchronisation entre utilisateurs n'est pas en temps réel, et les contenus signalés ne sont pas encore modérés automatiquement. Ne partagez pas d'informations sensibles tant qu'un vrai back-end sécurisé n'est pas en place.</p>
        </Card>

        <h3 className="sub-head">Politique de confidentialité</h3>
        <Card i={0}>
          <p className="muted">Les données saisies (identité, établissement, publications, messages) sont utilisées uniquement pour faire fonctionner les fonctionnalités du réseau : fil d'actualité, groupes et messagerie entre enseignants. Elles ne sont pas vendues ni partagées avec des tiers.</p>
          <p className="muted" style={{ marginTop: 8 }}>Vous pouvez à tout moment exporter vos données (Profil → Exporter mes données) ou supprimer votre compte (Paramètres → Compte). La suppression anonymise vos publications existantes plutôt que de les effacer entièrement, afin de préserver la cohérence des fils et des groupes.</p>
        </Card>

        <h3 className="sub-head">Données sensibles</h3>
        <Card i={0}>
          <p className="muted">Merci de ne pas publier de données personnelles d'élèves mineurs, de documents administratifs confidentiels ou de tout contenu protégé par le secret professionnel.</p>
        </Card>

        <h3 className="sub-head">Contact & signalement</h3>
        <Card i={0}>
          <p className="muted">Tout contenu abusif peut être signalé directement depuis les publications, groupes ou conversations concernées via l'icône de signalement.</p>
        </Card>
      </div>
    </div>
  );
}

function AdminOverlay({ data, accounts, profile, onClose, toggleSuspend, adminDeleteAccount, setVerification, resolveReport, addAnnonce, deleteAnnonce, toggleAnnoncePin, deletePublication, deleteGroupPost, deleteGroup, adminDeleteComment, broadcastMessage, approveNameChange, rejectNameChange }) {
  const [tab, setTab] = useState("apercu");
  const [confirmDeleteAcc, setConfirmDeleteAcc] = useState(null);
  const [userQuery, setUserQuery] = useState("");
  const [annonceForm, setAnnonceForm] = useState({ title: "", text: "" });
  const [confirmDeletePost, setConfirmDeletePost] = useState(null);
  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastSent, setBroadcastSent] = useState(false);

  const allAccounts = Object.values(accounts);
  const totalUsers = allAccounts.length;
  const suspendedCount = allAccounts.filter((a) => a.suspended).length;
  const pendingVerif = allAccounts.filter((a) => a.verification === "attente");
  const pendingNames = allAccounts.filter((a) => a.pendingName);
  const openReports = (data.reports || []).filter((r) => r.status !== "traite" && r.status !== "rejete");
  const totalPosts = data.publications.length + data.groupes.reduce((s, g) => s + (g.posts || []).length, 0);

  const filteredUsers = allAccounts.filter((a) => (a.name + a.identifiant + a.matiere).toLowerCase().includes(userQuery.toLowerCase()));

  const submitAnnonce = () => {
    if (!annonceForm.title.trim()) return;
    addAnnonce({ title: annonceForm.title, text: annonceForm.text, pinned: true });
    setAnnonceForm({ title: "", text: "" });
  };

  const reportTargetLabel = (r) => {
    if (r.targetType === "publication") return data.publications.find((p) => p.id === r.targetId)?.text?.slice(0, 60) || "Publication supprimée";
    if (r.targetType === "utilisateur") return accounts[r.targetId]?.name || "Utilisateur";
    if (r.targetType === "groupe") return data.groupes.find((g) => g.id === r.targetId)?.name || "Groupe supprimé";
    return r.targetId || "—";
  };

  return (
    <div className="chat-overlay">
      <div className="chat-head">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <h3><Crown size={16} style={{ verticalAlign: "-3px", marginRight: 6, color: "#C9932E" }} />Espace administrateur</h3>
      </div>
      <div className="screen">
        <div className="admin-tabs">
          {[["apercu", "Aperçu"], ["utilisateurs", "Utilisateurs"], ["verifications", `Vérifications${pendingVerif.length ? ` (${pendingVerif.length})` : ""}`], ["noms", `Noms${pendingNames.length ? ` (${pendingNames.length})` : ""}`], ["signalements", `Signalements${openReports.length ? ` (${openReports.length})` : ""}`], ["contenu", "Contenu"], ["annonces", "Annonces"], ["diffusion", "Message à tous"]].map(([key, label]) => (
            <button key={key} className={`chip small ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>{label}</button>
          ))}
        </div>

        {tab === "apercu" && (
          <>
            <div className="admin-stat-grid">
              <div className="dash-card"><p className="dash-num">{totalUsers}</p><p className="dash-label">Utilisateurs</p></div>
              <div className="dash-card"><p className="dash-num">{totalPosts}</p><p className="dash-label">Publications</p></div>
              <div className="dash-card"><p className="dash-num">{openReports.length}</p><p className="dash-label">Signalements ouverts</p></div>
              <div className="dash-card"><p className="dash-num">{pendingVerif.length}</p><p className="dash-label">Vérifications en attente</p></div>
              <div className="dash-card"><p className="dash-num">{suspendedCount}</p><p className="dash-label">Comptes suspendus</p></div>
              <div className="dash-card"><p className="dash-num">{data.groupes.length}</p><p className="dash-label">Groupes</p></div>
            </div>
            <p className="muted small">Connecté en tant qu'administrateur : {profile.name}.</p>
          </>
        )}

        {tab === "utilisateurs" && (
          <>
            <div className="search-row">
              <Search size={16} />
              <input placeholder="Nom, identifiant, matière…" value={userQuery} onChange={(e) => setUserQuery(e.target.value)} />
            </div>
            <div className="board">
              {filteredUsers.map((a, i) => (
                <Card key={a.id} i={i}>
                  <div className="post-head-row">
                    <div className="post-author-row">
                      <Avatar name={a.name} avatar={a.avatar} />
                      <div>
                        <h4>{a.name} <VerifBadge status={a.verification} /> {a.role === "admin" && <span className="admin-badge"><Crown size={12} /></span>}</h4>
                        <p className="meta">{a.identifiant} · {a.matiere} · {a.ville}</p>
                      </div>
                    </div>
                  </div>
                  {a.suspended && <Badge tone="pin">Compte suspendu</Badge>}
                  {a.id !== profile.id && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                      <button className="chip small" onClick={() => toggleSuspend(a.id)}>
                        {a.suspended ? <><UserCheck size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Réactiver</> : <><UserX size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Suspendre</>}
                      </button>
                      {confirmDeleteAcc === a.id ? (
                        <button className="chip small danger" onClick={() => { adminDeleteAccount(a.id); setConfirmDeleteAcc(null); }}>Confirmer la suppression ?</button>
                      ) : (
                        <button className="chip small danger" onClick={() => setConfirmDeleteAcc(a.id)}><Trash2 size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Supprimer</button>
                      )}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "verifications" && (
          <div className="board">
            {pendingVerif.length === 0 && <EmptyState label="Aucune demande de vérification en attente." />}
            {pendingVerif.map((a, i) => (
              <Card key={a.id} i={i}>
                <div className="post-author-row">
                  <Avatar name={a.name} avatar={a.avatar} />
                  <div>
                    <h4>{a.name}</h4>
                    <p className="meta">{a.etablissement}, {a.ville} · {a.matiere}</p>
                  </div>
                </div>
                <p className="meta"><Paperclip size={12} /> {a.verifDoc?.name || "Justificatif joint"}</p>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="chip small active" onClick={() => setVerification(a.id, "verifie")}><ShieldCheck size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Valider</button>
                  <button className="chip small danger" onClick={() => setVerification(a.id, "aucune")}><X size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Rejeter</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "noms" && (
          <div className="board">
            {pendingNames.length === 0 && <EmptyState label="Aucune demande de changement de nom en attente." />}
            {pendingNames.map((a, i) => (
              <Card key={a.id} i={i}>
                <div className="post-author-row">
                  <Avatar name={a.name} avatar={a.avatar} />
                  <div>
                    <h4>{a.name}</h4>
                    <p className="meta">souhaite s'appeler « {a.pendingName} »</p>
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="chip small active" onClick={() => approveNameChange(a.id)}><Check size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Valider</button>
                  <button className="chip small danger" onClick={() => rejectNameChange(a.id)}><X size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Refuser</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === "signalements" && (
          <div className="board">
            {(data.reports || []).length === 0 && <EmptyState label="Aucun signalement pour le moment." />}
            {(data.reports || []).map((r, i) => (
              <Card key={r.id} i={i}>
                <Badge tone={r.status === "traite" ? "sage" : r.status === "rejete" ? "ink" : "pin"}>{r.status === "traite" ? "Traité" : r.status === "rejete" ? "Rejeté" : "Ouvert"}</Badge>
                <h4>{r.reason}</h4>
                <p className="meta">Type : {r.targetType} · Signalé par : {accounts[r.byId]?.name || "Utilisateur"}</p>
                <p className="muted small">Concerne : {reportTargetLabel(r)}</p>
                {r.details && <p className="muted small">« {r.details} »</p>}
                {(!r.status || r.status === "ouvert") && (
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button className="chip small active" onClick={() => resolveReport(r.id, "traite")}>Marquer traité</button>
                    <button className="chip small" onClick={() => resolveReport(r.id, "rejete")}>Rejeter</button>
                    {r.targetType === "utilisateur" && r.targetId && r.targetId !== profile.id && (
                      <button className="chip small danger" onClick={() => { toggleSuspend(r.targetId); resolveReport(r.id, "traite"); }}><UserX size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Suspendre le compte</button>
                    )}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        {tab === "contenu" && (
          <div className="board">
            <h3 className="sub-head" style={{ margin: "0 0 6px" }}>Publications du fil</h3>
            {data.publications.length === 0 && <EmptyState label="Aucune publication." />}
            {data.publications.map((p, i) => (
              <Card key={p.id} i={i}>
                <p className="meta">{p.author} · {p.date}</p>
                <p className="muted post-body">{p.text}</p>
                {confirmDeletePost === p.id ? (
                  <button className="chip small danger" onClick={() => { deletePublication(p.id); setConfirmDeletePost(null); }}>Confirmer la suppression ?</button>
                ) : (
                  <button className="chip small danger" onClick={() => setConfirmDeletePost(p.id)}><Trash2 size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Supprimer</button>
                )}
              </Card>
            ))}
            <h3 className="sub-head">Publications de groupes</h3>
            {data.groupes.flatMap((g) => (g.posts || []).map((p) => ({ ...p, groupName: g.name, groupId: g.id }))).length === 0 && <EmptyState label="Aucune publication de groupe." />}
            {data.groupes.flatMap((g) => (g.posts || []).map((p) => ({ ...p, groupName: g.name, groupId: g.id }))).map((p, i) => (
              <Card key={p.id} i={i}>
                <p className="meta">{p.author} · {p.groupName} · {p.date}</p>
                <p className="muted post-body">{p.text}</p>
                {confirmDeletePost === p.id ? (
                  <button className="chip small danger" onClick={() => { deleteGroupPost(p.groupId, p.id); setConfirmDeletePost(null); }}>Confirmer la suppression ?</button>
                ) : (
                  <button className="chip small danger" onClick={() => setConfirmDeletePost(p.id)}><Trash2 size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Supprimer</button>
                )}
              </Card>
            ))}
            <h3 className="sub-head">Groupes</h3>
            {data.groupes.map((g, i) => (
              <Card key={g.id} i={i}>
                <p className="meta">{g.name} · admin : {g.admin} · {(g.memberIds || []).length} membre(s)</p>
                {confirmDeletePost === `g_${g.id}` ? (
                  <button className="chip small danger" onClick={() => { deleteGroup(g.id); setConfirmDeletePost(null); }}>Confirmer la suppression ?</button>
                ) : (
                  <button className="chip small danger" onClick={() => setConfirmDeletePost(`g_${g.id}`)}><Trash2 size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Supprimer le groupe</button>
                )}
              </Card>
            ))}
          </div>
        )}

        {tab === "annonces" && (
          <>
            <Card i={0}>
              <div className="form-row">
                <label>Titre de l'annonce</label>
                <input value={annonceForm.title} onChange={(e) => setAnnonceForm({ ...annonceForm, title: e.target.value })} placeholder="Ex. Maintenance prévue ce week-end" />
              </div>
              <div className="form-row">
                <label>Message</label>
                <textarea rows={3} value={annonceForm.text} onChange={(e) => setAnnonceForm({ ...annonceForm, text: e.target.value })} />
              </div>
              <button className="btn-primary" onClick={submitAnnonce}><Megaphone size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Publier l'annonce à tous les enseignants</button>
            </Card>
            <div className="board">
              {(data.annonces || []).map((a, i) => (
                <Card key={a.id} i={i}>
                  <p className="meta">{a.date} {a.pinned && "· épinglée sur le fil"}</p>
                  <h4>{a.title}</h4>
                  <p className="muted">{a.text}</p>
                  <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                    <button className="chip small" onClick={() => toggleAnnoncePin(a.id)}>{a.pinned ? "Retirer du fil" : "Épingler sur le fil"}</button>
                    <button className="chip small danger" onClick={() => deleteAnnonce(a.id)}><Trash2 size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Supprimer</button>
                  </div>
                </Card>
              ))}
            </div>
          </>
        )}

        {tab === "diffusion" && (
          <>
            <Card i={0}>
              <p className="muted small" style={{ marginBottom: 10 }}><Send size={12} style={{ verticalAlign: "-2px" }} /> Ce message sera envoyé en messagerie directe à chaque enseignant inscrit sur ClassPro (un fil de discussion par personne).</p>
              <div className="form-row">
                <label>Message</label>
                <textarea rows={4} value={broadcastText} onChange={(e) => { setBroadcastText(e.target.value); setBroadcastSent(false); }} placeholder="Ex. Bienvenue à tous ! N'hésitez pas à compléter votre profil…" />
              </div>
              {broadcastSent && <p className="muted small" style={{ color: "#1E8A4C" }}><Check size={12} style={{ verticalAlign: "-2px" }} /> Message envoyé à {Object.keys(accounts).length - 1} enseignant(s).</p>}
              <button
                className="btn-primary"
                disabled={!broadcastText.trim()}
                onClick={() => { broadcastMessage(broadcastText); setBroadcastText(""); setBroadcastSent(true); }}
              >
                <Send size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Envoyer à tous les enseignants
              </button>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}

function CredentialsForm({ profile, updateCredentials }) {
  const [identifiant, setIdentifiant] = useState(profile.identifiant || "");
  const [newPassword, setNewPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [message, setMessage] = useState(null); // { type: "error" | "success", text }

  const submit = () => {
    const result = updateCredentials(identifiant, newPassword, currentPassword);
    if (result.ok) {
      setMessage({ type: "success", text: "Identifiants mis à jour." });
      setNewPassword(""); setCurrentPassword("");
    } else {
      setMessage({ type: "error", text: result.error });
    }
  };

  return (
    <>
      <p className="muted small" style={{ marginBottom: 8 }}>Identifiant actuel : <b>{profile.identifiant}</b></p>
      <div className="form-row">
        <label>Nouvel identifiant (email ou téléphone)</label>
        <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} />
      </div>
      <div className="form-row">
        <label>Nouveau mot de passe (laisser vide pour ne pas changer)</label>
        <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="4 caractères minimum" />
      </div>
      <div className="form-row">
        <label>Mot de passe actuel (pour confirmer)</label>
        <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
      </div>
      {message && <p className={message.type === "error" ? "error-text" : "muted small"} style={message.type === "success" ? { color: "#1E8A4C" } : undefined}>{message.text}</p>}
      <button className="btn-primary" onClick={submit}><KeyRound size={14} style={{ verticalAlign: "-2px", marginRight: 6 }} />Mettre à jour mes identifiants</button>
    </>
  );
}

function ParametresOverlay({ profile, onClose, onLogout, appSettings, updateAppSettings, exportMyData, deleteAccount, accounts, toggleBlock, onOpenLegal, updateCredentials }) {
  const [confirmDelete, setConfirmDelete] = useState(0);
  const blockedAccounts = (profile.blockedIds || []).map((id) => accounts?.[id]).filter(Boolean);
  return (
    <div className="chat-overlay">
      <div className="chat-head">
        <button className="icon-btn" onClick={onClose}><ChevronLeft size={18} /></button>
        <h3>Paramètres de l'application</h3>
      </div>
      <div className="screen">
        <h3 className="sub-head">Notifications</h3>
        <Card i={0}>
          <div className="settings-toggle-row">
            <span>Publications &amp; interactions</span>
            <button className={`chip small ${appSettings.notifPosts ? "active" : ""}`} onClick={() => updateAppSettings({ notifPosts: !appSettings.notifPosts })}>
              {appSettings.notifPosts ? "Activées" : "Désactivées"}
            </button>
          </div>
        </Card>

        <h3 className="sub-head">Messagerie</h3>
        <Card i={1}>
          <div className="settings-toggle-row">
            <span>Notifications de messages</span>
            <button className={`chip small ${appSettings.notifMessages ? "active" : ""}`} onClick={() => updateAppSettings({ notifMessages: !appSettings.notifMessages })}>
              {appSettings.notifMessages ? "Activées" : "Désactivées"}
            </button>
          </div>
          <div className="settings-toggle-row">
            <span>Aperçu du texte dans les notifications</span>
            <button className={`chip small ${appSettings.messagePreview ? "active" : ""}`} onClick={() => updateAppSettings({ messagePreview: !appSettings.messagePreview })}>
              {appSettings.messagePreview ? "Activé" : "Masqué"}
            </button>
          </div>
          <div className="settings-toggle-row">
            <span>Qui peut m'envoyer un message</span>
            <button className="chip small active" onClick={() => updateAppSettings({ messagePrivacy: appSettings.messagePrivacy === "tous" ? "personne" : "tous" })}>
              {appSettings.messagePrivacy === "personne" ? "Personne" : "Tout le monde"}
            </button>
          </div>
        </Card>

        <h3 className="sub-head">Plateforme</h3>
        <Card i={0}>
          <div className="settings-toggle-row">
            <span>Profil visible dans la recherche</span>
            <button className={`chip small ${appSettings.profileSearchable !== false ? "active" : ""}`} onClick={() => updateAppSettings({ profileSearchable: appSettings.profileSearchable === false })}>
              {appSettings.profileSearchable !== false ? "Visible" : "Masqué"}
            </button>
          </div>
          <div className="settings-toggle-row">
            <span>Suggestions de groupes</span>
            <button className={`chip small ${appSettings.groupSuggestions !== false ? "active" : ""}`} onClick={() => updateAppSettings({ groupSuggestions: appSettings.groupSuggestions === false })}>
              {appSettings.groupSuggestions !== false ? "Activées" : "Désactivées"}
            </button>
          </div>
        </Card>

        <h3 className="sub-head">Comptes bloqués</h3>
        <Card i={0}>
          {blockedAccounts.length === 0 ? (
            <p className="muted small">Vous n'avez bloqué personne.</p>
          ) : (
            blockedAccounts.map((a) => (
              <div key={a.id} className="settings-toggle-row">
                <span><Ban size={12} style={{ verticalAlign: "-2px", marginRight: 5 }} />{a.name}</span>
                <button className="chip small" onClick={() => toggleBlock(a.id)}>Débloquer</button>
              </div>
            ))
          )}
        </Card>

        <h3 className="sub-head">Identifiants de connexion</h3>
        <Card i={0}>
          <CredentialsForm profile={profile} updateCredentials={updateCredentials} />
        </Card>

        <h3 className="sub-head">Compte</h3>
        <Card i={1}>
          <p className="muted">{profile.name} · {profile.etablissement}, {profile.ville}</p>
          <p className="meta">Identifiant : {profile.identifiant}</p>
          <button className="chip settings-row" onClick={exportMyData}><Download size={14} /> Exporter mes données</button>
          <button className="chip settings-row danger" onClick={onLogout}><LogOut size={14} /> Se déconnecter</button>
          {confirmDelete === 0 && (
            <button className="chip settings-row danger" onClick={() => setConfirmDelete(1)}><Trash2 size={14} /> Supprimer mon compte</button>
          )}
          {confirmDelete === 1 && (
            <div className="danger-confirm-box">
              <p className="muted small"><AlertTriangle size={12} style={{ verticalAlign: "-2px" }} /> Cette action est définitive : votre compte et vos identifiants seront supprimés. Vos publications resteront visibles mais anonymisées.</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="chip small" onClick={() => setConfirmDelete(0)}>Annuler</button>
                <button className="btn-danger" onClick={() => setConfirmDelete(2)}>Continuer</button>
              </div>
            </div>
          )}
          {confirmDelete === 2 && (
            <div className="danger-confirm-box">
              <p className="muted small">Dernière confirmation : supprimer définitivement le compte de <b>{profile.name}</b> ?</p>
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="chip small" onClick={() => setConfirmDelete(0)}>Annuler</button>
                <button className="btn-danger" onClick={deleteAccount}>Oui, supprimer définitivement</button>
              </div>
            </div>
          )}
        </Card>
        <h3 className="sub-head">À propos</h3>
        <Card i={0}>
          <p className="muted">ClassPro — le réseau des enseignants du Bénin. Version prototype.</p>
          <button className="chip settings-row" onClick={onOpenLegal}><ScrollText size={14} /> Mentions légales &amp; politique de confidentialité</button>
        </Card>
      </div>
    </div>
  );
}

function ProfileForm({ initial, onDone, submitLabel = "Continuer", editMode = false }) {
  const [form, setForm] = useState(initial || {
    name: "", matiere: MATIERES[0], niveau: "", etablissement: "",
    departement: DEPARTEMENTS[0], ville: BENIN[DEPARTEMENTS[0]][0], anciennete: "",
    avatar: null, verifDoc: null, verification: "aucune",
  });
  const [error, setError] = useState("");
  const avatarRef = useRef(null);
  const docRef = useRef(null);
  const valid = form.name.trim() && form.niveau.trim() && form.etablissement.trim() && form.ville;

  const setDepartement = (dep) => {
    setForm({ ...form, departement: dep, ville: BENIN[dep][0] });
  };

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("Photo trop volumineuse (max 3 Mo)."); e.target.value = ""; return; }
    const { dataUrl } = await compressImage(file, { maxDim: 480, quality: 0.75 });
    setForm({ ...form, avatar: dataUrl });
    e.target.value = "";
  };

  const handleVerifDoc = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) { setError("Document trop volumineux (max 3 Mo)."); e.target.value = ""; return; }
    if (file.type.startsWith("image/")) {
      const { dataUrl } = await compressImage(file, { maxDim: 1600, quality: 0.78 });
      setForm({ ...form, verifDoc: { name: file.name, dataUrl }, verification: "attente" });
    } else {
      setForm({ ...form, verifDoc: { name: file.name }, verification: "attente" });
    }
    e.target.value = "";
  };

  return (
    <>
      <div className="form-row avatar-row">
        <Avatar name={form.name || "?"} avatar={form.avatar} size="lg" />
        <div>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatar} />
          <button className="chip small" onClick={() => avatarRef.current?.click()}>
            <Camera size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} /> Photo de profil
          </button>
        </div>
      </div>
      <div className="form-row">
        <label>Nom complet</label>
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      </div>
      <div className="form-row two">
        <div>
          <label>Matière</label>
          <select value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })}>
            {MATIERES.map((m) => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label>Niveau</label>
          <select value={form.niveau} onChange={(e) => setForm({ ...form, niveau: e.target.value })}>
            <option value="">Choisir…</option>
            {NIVEAUX.map((n) => <option key={n}>{n}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <label>Établissement</label>
        <input value={form.etablissement} onChange={(e) => setForm({ ...form, etablissement: e.target.value })} />
      </div>
      <div className="form-row two">
        <div>
          <label>Département</label>
          <select value={form.departement} onChange={(e) => setDepartement(e.target.value)}>
            {DEPARTEMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label>Commune</label>
          <select value={form.ville} onChange={(e) => setForm({ ...form, ville: e.target.value })}>
            {BENIN[form.departement].map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div className="form-row">
        <label>Ancienneté</label>
        <input value={form.anciennete} onChange={(e) => setForm({ ...form, anciennete: e.target.value })} placeholder="Ex. 5 ans" />
      </div>
      <div className="form-row">
        <label>Justificatif de statut (facultatif — pour la demande de badge vérifié)</label>
        <input ref={docRef} type="file" accept="image/*,.pdf" style={{ display: "none" }} onChange={handleVerifDoc} />
        <button className="chip small" onClick={() => docRef.current?.click()}>
          <Paperclip size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />
          {form.verifDoc ? form.verifDoc.name : "Joindre une pièce d'établissement"}
        </button>
        {form.verification === "attente" && <p className="muted small" style={{ marginTop: 4 }}><ShieldAlert size={11} style={{ verticalAlign: "-1px" }} /> Sera soumis pour vérification manuelle après {editMode ? "l'enregistrement" : "l'inscription"}.</p>}
      </div>
      {error && <p className="error-text">{error}</p>}
      <button className="btn-primary" disabled={!valid} onClick={() => onDone(form)}>{submitLabel}</button>
    </>
  );
}

function AuthScreen({ onLogin, onSignup, accounts, onResetPassword }) {
  const [mode, setMode] = useState("login");
  const [identifiant, setIdentifiant] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const submitLogin = () => {
    const account = Object.values(accounts).find((a) => a.identifiant.toLowerCase() === identifiant.trim().toLowerCase());
    if (!account || account.password !== password) {
      setError("Identifiant ou mot de passe incorrect.");
      return;
    }
    if (account.suspended) {
      setError("Ce compte a été suspendu par l'administration de ClassPro.");
      return;
    }
    setError("");
    onLogin(account.id);
  };

  const submitSignup = (form, credentials) => {
    const exists = Object.values(accounts).some((a) => a.identifiant.toLowerCase() === credentials.identifiant.trim().toLowerCase());
    if (exists) { setError("Cet identifiant est déjà utilisé."); return false; }
    if (!credentials.identifiant.trim() || credentials.password.length < 4) { setError("Identifiant et mot de passe (4 caractères min.) requis."); return false; }
    if (!credentials.securityAnswer.trim()) { setError("Merci de répondre à la question de sécurité (utile en cas de mot de passe oublié)."); return false; }
    setError("");
    return true;
  };

  const finalizeSignup = (form, credentials) => {
    onSignup({
      ...form,
      identifiant: credentials.identifiant.trim(),
      password: credentials.password,
      securityQuestion: credentials.securityQuestion,
      securityAnswer: credentials.securityAnswer.trim().toLowerCase(),
    });
  };

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <p className="hero-eyebrow">Bienvenue sur</p>
        <h1 className="brand">ClassPro</h1>
        <p className="muted center small">Le réseau des enseignants du Bénin</p>
        {mode !== "forgot" && (
          <div className="auth-toggle">
            <button className={`chip small ${mode === "login" ? "active" : ""}`} onClick={() => { setMode("login"); setError(""); }}><LogIn size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Se connecter</button>
            <button className={`chip small ${mode === "signup" ? "active" : ""}`} onClick={() => { setMode("signup"); setError(""); }}><UserPlus size={12} style={{ verticalAlign: "-2px", marginRight: 4 }} />Créer un compte</button>
          </div>
        )}
        {error && <p className="error-text">{error}</p>}
        {mode === "login" && (
          <>
            <div className="form-row">
              <label>Identifiant (email ou téléphone)</label>
              <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="vous@exemple.bj" />
            </div>
            <div className="form-row">
              <label>Mot de passe</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button className="btn-primary" onClick={submitLogin}>Se connecter</button>
            <button className="chip small" style={{ marginTop: 12 }} onClick={() => { setMode("forgot"); setError(""); }}>Mot de passe oublié ?</button>
          </>
        )}
        {mode === "signup" && (
          <SignupForm onValidate={submitSignup} onFinalize={finalizeSignup} />
        )}
        {mode === "forgot" && (
          <ForgotPasswordFlow accounts={accounts} onResetPassword={onResetPassword} onBack={() => { setMode("login"); setError(""); }} />
        )}
      </div>
    </div>
  );
}

function SignupForm({ onValidate, onFinalize }) {
  const [credentials, setCredentials] = useState({ identifiant: "", password: "", securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: "" });
  const [step, setStep] = useState("form"); // form | verify
  const [pendingProfile, setPendingProfile] = useState(null);
  const [code, setCode] = useState("");
  const [genCode, setGenCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [emailStatus, setEmailStatus] = useState("idle"); // idle | sending | sent | failed | not-email

  const handleProfileDone = async (form) => {
    if (!onValidate(form, credentials)) return;
    const generated = String(Math.floor(100000 + Math.random() * 900000));
    setGenCode(generated);
    setPendingProfile(form);
    setStep("verify");
    const isEmail = credentials.identifiant.includes("@");
    if (!isEmail) { setEmailStatus("not-email"); return; }
    setEmailStatus("sending");
    try {
      const res = await fetch("/api/send-verification-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: credentials.identifiant.trim(), code: generated, name: form.name }),
      });
      setEmailStatus(res.ok ? "sent" : "failed");
    } catch {
      setEmailStatus("failed");
    }
  };

  const confirmCode = () => {
    if (code.trim() !== genCode) { setCodeError("Code incorrect. Réessayez."); return; }
    onFinalize(pendingProfile, credentials);
  };

  if (step === "verify") {
    return (
      <div className="verify-box">
        <ShieldQuestion size={26} style={{ color: "var(--primary)" }} />
        <h3 style={{ margin: "8px 0 2px" }}>Vérifiez votre identifiant</h3>
        {emailStatus === "sending" && <p className="muted small">Envoi de l'email en cours…</p>}
        {emailStatus === "sent" && (
          <p className="muted small">Un code à 6 chiffres a été envoyé par email à <b>{credentials.identifiant}</b>. Pensez à vérifier vos spams.</p>
        )}
        {(emailStatus === "failed" || emailStatus === "not-email" || emailStatus === "idle") && (
          <>
            <p className="muted small">Un code à 6 chiffres a été envoyé à <b>{credentials.identifiant}</b>.</p>
            <p className="muted small verify-demo-note">
              {emailStatus === "failed" ? "L'envoi de l'email a échoué — " : "Mode démo — "}
              voici le code : <b>{genCode}</b>
            </p>
          </>
        )}
        <div className="form-row">
          <label>Code de vérification</label>
          <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" maxLength={6} />
        </div>
        {codeError && <p className="error-text">{codeError}</p>}
        <button className="btn-primary" onClick={confirmCode}>Confirmer et créer mon compte</button>
        <button className="chip small" style={{ marginTop: 10 }} onClick={() => setStep("form")}>Retour</button>
      </div>
    );
  }

  return (
    <>
      <div className="form-row">
        <label>Identifiant (email ou téléphone)</label>
        <input value={credentials.identifiant} onChange={(e) => setCredentials({ ...credentials, identifiant: e.target.value })} placeholder="vous@exemple.bj" />
      </div>
      <div className="form-row">
        <label>Mot de passe</label>
        <input type="password" value={credentials.password} onChange={(e) => setCredentials({ ...credentials, password: e.target.value })} placeholder="4 caractères minimum" />
      </div>
      <div className="form-row">
        <label><HelpCircle size={12} style={{ verticalAlign: "-2px" }} /> Question de sécurité (pour récupérer votre compte)</label>
        <select value={credentials.securityQuestion} onChange={(e) => setCredentials({ ...credentials, securityQuestion: e.target.value })}>
          {SECURITY_QUESTIONS.map((q) => <option key={q}>{q}</option>)}
        </select>
      </div>
      <div className="form-row">
        <label>Votre réponse</label>
        <input value={credentials.securityAnswer} onChange={(e) => setCredentials({ ...credentials, securityAnswer: e.target.value })} placeholder="Réponse mémorable" />
      </div>
      <ProfileForm submitLabel="Continuer" onDone={handleProfileDone} />
    </>
  );
}

function ForgotPasswordFlow({ accounts, onResetPassword, onBack }) {
  const [step, setStep] = useState("identify"); // identify | question | reset | done
  const [identifiant, setIdentifiant] = useState("");
  const [account, setAccount] = useState(null);
  const [answer, setAnswer] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");

  const findAccount = () => {
    const acc = Object.values(accounts).find((a) => a.identifiant.toLowerCase() === identifiant.trim().toLowerCase());
    if (!acc || !acc.securityQuestion) { setError("Identifiant introuvable ou compte sans question de sécurité configurée."); return; }
    setAccount(acc);
    setError("");
    setStep("question");
  };

  const checkAnswer = () => {
    if (answer.trim().toLowerCase() !== (account.securityAnswer || "").toLowerCase()) {
      setError("Réponse incorrecte.");
      return;
    }
    setError("");
    setStep("reset");
  };

  const doReset = () => {
    if (newPassword.length < 4) { setError("4 caractères minimum."); return; }
    onResetPassword(account.id, newPassword);
    setStep("done");
  };

  return (
    <div className="verify-box">
      <KeyRound size={26} style={{ color: "var(--primary)" }} />
      <h3 style={{ margin: "8px 0 2px" }}>Mot de passe oublié</h3>
      {error && <p className="error-text">{error}</p>}
      {step === "identify" && (
        <>
          <div className="form-row">
            <label>Identifiant (email ou téléphone)</label>
            <input value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} placeholder="vous@exemple.bj" />
          </div>
          <button className="btn-primary" onClick={findAccount}>Continuer</button>
        </>
      )}
      {step === "question" && (
        <>
          <p className="muted small">{account.securityQuestion}</p>
          <div className="form-row">
            <label>Votre réponse</label>
            <input value={answer} onChange={(e) => setAnswer(e.target.value)} />
          </div>
          <button className="btn-primary" onClick={checkAnswer}>Vérifier</button>
        </>
      )}
      {step === "reset" && (
        <>
          <div className="form-row">
            <label>Nouveau mot de passe</label>
            <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="4 caractères minimum" />
          </div>
          <button className="btn-primary" onClick={doReset}>Réinitialiser mon mot de passe</button>
        </>
      )}
      {step === "done" && (
        <p className="muted small">Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.</p>
      )}
      <button className="chip small" style={{ marginTop: 10 }} onClick={onBack}>Retour à la connexion</button>
    </div>
  );
}

export default function ClassPro() {
  const [ready, setReady] = useState(false);
  const [data, setData] = useState(null);
  const [accounts, setAccounts] = useState(null);
  const [profileId, setProfileId] = useState(null);
  const [tab, setTab] = useState("home");
  const [overlay, setOverlay] = useState(null);
  const [appSettings, setAppSettings] = useState({ notifPosts: true, notifMessages: true, messagePreview: true, messagePrivacy: "tous", profileSearchable: true, groupSuggestions: true });
  const [openThread, setOpenThread] = useState(null);
  const [inviteGroupId, setInviteGroupId] = useState(() => {
    try { return new URLSearchParams(window.location.search).get("rejoindre"); } catch (e) { return null; }
  });

  useEffect(() => {
    if (inviteGroupId && profile) {
      setTab("groupes");
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete("rejoindre");
        window.history.replaceState({}, "", url);
      } catch (e) { /* pas grave */ }
    }
  }, [inviteGroupId, profileId]);

  useEffect(() => {
    (async () => {
      let d, a, s;
      try { const res = await window.storage.get(DATA_KEY, true); d = JSON.parse(res.value); }
      catch { d = seedData(); try { await window.storage.set(DATA_KEY, JSON.stringify(d), true); } catch (e) { console.error(e); } }
      try { const res2 = await window.storage.get(ACCOUNTS_KEY, true); a = JSON.parse(res2.value); }
      catch { a = seedAccounts(); try { await window.storage.set(ACCOUNTS_KEY, JSON.stringify(a), true); } catch (e) { console.error(e); } }
      try { const res3 = await window.storage.get(SESSION_KEY, false); s = JSON.parse(res3.value); }
      catch { s = null; }
      setData(d); setAccounts(a); setProfileId(s?.accountId && a[s.accountId] ? s.accountId : null); setReady(true);
    })();
  }, []);

  useDebouncedSave(data);
  useDebouncedSaveAccounts(accounts);

  // Synchronisation périodique légère : recharge les données partagées toutes les 8s
  // pour que les changements des autres utilisateurs apparaissent sans rechargement manuel.
  // Ce n'est pas du temps réel (websockets), mais ça atténue fortement le problème.
  useEffect(() => {
    if (!ready) return;
    const interval = setInterval(async () => {
      try {
        const res = await window.storage.get(DATA_KEY, true);
        const fresh = JSON.parse(res.value);
        setData((prev) => (JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh));
      } catch (e) { /* pas grave, on retentera au prochain tick */ }
      try {
        const res2 = await window.storage.get(ACCOUNTS_KEY, true);
        const freshA = JSON.parse(res2.value);
        setAccounts((prev) => (JSON.stringify(prev) === JSON.stringify(freshA) ? prev : freshA));
      } catch (e) { /* idem */ }
    }, 8000);
    return () => clearInterval(interval);
  }, [ready]);

  const profile = profileId && accounts ? accounts[profileId] : null;

  const login = async (accountId) => {
    setProfileId(accountId);
    try { await window.storage.set(SESSION_KEY, JSON.stringify({ accountId }), false); } catch (e) { console.error(e); }
  };

  const signup = async (form) => {
    const id = uid("acc");
    const account = { id, verification: "aucune", avatar: null, verifDoc: null, blockedIds: [], role: "membre", suspended: false, pendingName: null, ...form, createdAt: Date.now() };
    setAccounts((a) => ({ ...a, [id]: account }));
    await login(id);
  };

  const resetPassword = (accountId, newPassword) => {
    setAccounts((a) => ({ ...a, [accountId]: { ...a[accountId], password: newPassword } }));
  };

  const updateCredentials = (newIdentifiant, newPassword, currentPassword) => {
    const acc = accounts[profileId];
    if (!acc || acc.password !== currentPassword) return { ok: false, error: "Mot de passe actuel incorrect." };
    const trimmed = (newIdentifiant || "").trim();
    if (!trimmed) return { ok: false, error: "Identifiant requis." };
    const taken = Object.values(accounts).some((a) => a.id !== profileId && a.identifiant.toLowerCase() === trimmed.toLowerCase());
    if (taken) return { ok: false, error: "Cet identifiant est déjà utilisé par un autre compte." };
    if (newPassword && newPassword.length < 4) return { ok: false, error: "Le nouveau mot de passe doit faire au moins 4 caractères." };
    setAccounts((a) => ({ ...a, [profileId]: { ...a[profileId], identifiant: trimmed, password: newPassword ? newPassword : a[profileId].password } }));
    return { ok: true };
  };

  const toggleBlock = (targetId) => {
    if (!profile || !targetId) return;
    const already = (profile.blockedIds || []).includes(targetId);
    setAccounts((a) => ({
      ...a,
      [profileId]: { ...a[profileId], blockedIds: already ? (a[profileId].blockedIds || []).filter((x) => x !== targetId) : [...(a[profileId].blockedIds || []), targetId] },
    }));
    if (openThread) {
      const t = data.threads.find((x) => x.id === openThread);
      if (t && (t.participantIds || []).includes(targetId)) setOpenThread(null);
    }
  };

  const updateProfile = (form) => {
    setAccounts((a) => {
      const current = a[profileId];
      const nameChanged = form.name && form.name.trim() && form.name.trim() !== current.name;
      const skipApproval = current.role === "admin"; // le fondateur valide lui-même, pas besoin de circuit d'attente
      const nextName = (nameChanged && !skipApproval) ? current.name : (form.name?.trim() || current.name);
      const updated = {
        ...current, ...form,
        name: nextName,
        pendingName: (nameChanged && !skipApproval) ? form.name.trim() : (nameChanged ? null : current.pendingName),
        id: profileId, identifiant: current.identifiant, password: current.password,
      };
      return { ...a, [profileId]: updated };
    });
    if (form.name && form.name.trim() && form.name.trim() !== accounts[profileId].name && accounts[profileId].role !== "admin") {
      const requesterName = accounts[profileId].name;
      const newName = form.name.trim();
      Object.values(accounts).filter((a) => a.role === "admin").forEach((adm) => notify(`${requesterName} souhaite changer son nom en « ${newName} ».`, adm.id));
    }
  };

  const approveNameChange = (accountId) => {
    setAccounts((a) => ({ ...a, [accountId]: { ...a[accountId], name: a[accountId].pendingName || a[accountId].name, pendingName: null } }));
    notify("Votre changement de nom a été validé par l'administration.", accountId);
  };
  const rejectNameChange = (accountId) => {
    setAccounts((a) => ({ ...a, [accountId]: { ...a[accountId], pendingName: null } }));
    notify("Votre demande de changement de nom a été refusée par l'administration.", accountId);
  };

  const logout = async () => {
    setProfileId(null);
    setOverlay(null);
    try { await window.storage.delete(SESSION_KEY, false); } catch (e) { console.error(e); }
  };

  const exportMyData = () => {
    if (!profile) return;
    const myPublications = data.publications.filter((p) => p.authorId === profile.id);
    const myMessages = data.threads.flatMap((t) => t.messages.filter((m) => m.authorId === profile.id).map((m) => ({ ...m, threadId: t.id })));
    const myGroupPosts = data.groupes.flatMap((g) => (g.posts || []).filter((p) => p.authorId === profile.id).map((p) => ({ ...p, groupId: g.id })));
    downloadJSON(`classpro-mes-donnees-${profile.name.replace(/\s+/g, "-").toLowerCase()}.json`, {
      profil: { ...profile, password: undefined },
      publications: myPublications,
      publicationsDeGroupe: myGroupPosts,
      messages: myMessages,
    });
  };

  const deleteAccount = async () => {
    const id = profileId;
    setData((d) => ({
      ...d,
      publications: d.publications.map((p) => p.authorId === id ? { ...p, author: "Compte supprimé", authorId: null } : p),
      groupes: d.groupes.map((g) => ({
        ...g,
        memberIds: (g.memberIds || []).filter((m) => m !== id),
        adminId: g.adminId === id ? null : g.adminId,
        posts: (g.posts || []).map((p) => p.authorId === id ? { ...p, author: "Compte supprimé", authorId: null } : p),
      })),
    }));
    setAccounts((a) => { const copy = { ...a }; delete copy[id]; return copy; });
    await logout();
  };

  const addReport = (report) => setData((d) => ({ ...d, reports: [{ id: uid("r"), byId: profileId, date: new Date().toISOString(), status: "ouvert", ...report }, ...(d.reports || [])] }));

  const toggleSuspend = (accountId) => {
    if (accountId === profileId) return;
    setAccounts((a) => ({ ...a, [accountId]: { ...a[accountId], suspended: !a[accountId].suspended } }));
  };

  const adminDeleteAccount = (accountId) => {
    if (accountId === profileId) return;
    setData((d) => ({
      ...d,
      publications: d.publications.map((p) => p.authorId === accountId ? { ...p, author: "Compte supprimé", authorId: null } : p),
      groupes: d.groupes.map((g) => ({
        ...g,
        memberIds: (g.memberIds || []).filter((m) => m !== accountId),
        adminId: g.adminId === accountId ? null : g.adminId,
        posts: (g.posts || []).map((p) => p.authorId === accountId ? { ...p, author: "Compte supprimé", authorId: null } : p),
      })),
    }));
    setAccounts((a) => { const copy = { ...a }; delete copy[accountId]; return copy; });
  };

  const setVerification = (accountId, status) => {
    setAccounts((a) => ({ ...a, [accountId]: { ...a[accountId], verification: status } }));
    notify(status === "verifie" ? "Votre identité a été vérifiée par l'administration. Badge activé !" : "Votre demande de vérification a été rejetée. Vous pouvez soumettre un nouveau justificatif.", accountId);
  };

  const resolveReport = (reportId, status) => {
    setData((d) => ({ ...d, reports: (d.reports || []).map((r) => r.id === reportId ? { ...r, status } : r) }));
  };

  const addAnnonce = (annonce) => setData((d) => ({ ...d, annonces: [{ id: uid("an"), date: new Date().toISOString().slice(0, 10), pinned: false, ...annonce }, ...(d.annonces || [])] }));
  const deleteAnnonce = (id) => setData((d) => ({ ...d, annonces: (d.annonces || []).filter((a) => a.id !== id) }));
  const toggleAnnoncePin = (id) => setData((d) => ({ ...d, annonces: (d.annonces || []).map((a) => a.id === id ? { ...a, pinned: !a.pinned } : a) }));

  const adminDeleteComment = (postId, commentId) => setData((d) => ({ ...d, publications: d.publications.map((p) => p.id === postId ? { ...p, commentsList: (p.commentsList || []).filter((c) => c.id !== commentId) } : p) }));

  const notify = (text, toId) => setData((d) => ({ ...d, notifications: [{ id: uid("n"), text, time: "à l'instant", to: toId, read: false }, ...d.notifications] }));

  const addPublication = async (p) => setData((d) => ({ ...d, publications: [p, ...d.publications] }));
  const likePost = (id) => {
    setData((d) => ({ ...d, publications: d.publications.map((p) => {
      if (p.id !== id) return p;
      const already = (p.likedBy || []).includes(profile.id);
      return { ...p, likedBy: already ? p.likedBy.filter((n) => n !== profile.id) : [...(p.likedBy || []), profile.id] };
    }) }));
    const post = data.publications.find((p) => p.id === id);
    if (post && !(post.likedBy || []).includes(profile.id) && post.authorId !== profile.id) {
      notify(`${profile.name} a aimé votre publication.`, post.authorId);
    }
  };
  const addComment = (postId, comment) => {
    setData((d) => ({ ...d, publications: d.publications.map((p) => p.id === postId ? { ...p, commentsList: [...(p.commentsList || []), comment] } : p) }));
    const post = data.publications.find((p) => p.id === postId);
    if (post && post.authorId !== profile.id) notify(`${profile.name} a commenté votre publication.`, post.authorId);
  };
  const updateComment = (postId, commentId, text) => setData((d) => ({ ...d, publications: d.publications.map((p) => p.id === postId ? { ...p, commentsList: (p.commentsList || []).map((c) => c.id === commentId ? { ...c, text, edited: true } : c) } : p) }));
  const deleteComment = (postId, commentId) => setData((d) => ({ ...d, publications: d.publications.map((p) => p.id === postId ? { ...p, commentsList: (p.commentsList || []).filter((c) => c.id !== commentId) } : p) }));
  const updatePublication = (id, changes) => setData((d) => ({ ...d, publications: d.publications.map((p) => p.id === id ? { ...p, ...changes } : p) }));
  const deletePublication = (id) => setData((d) => ({ ...d, publications: d.publications.filter((p) => p.id !== id) }));

  const toggleJoin = (id) => {
    const group = data.groupes.find((g) => g.id === id);
    const isMember = (group.memberIds || []).includes(profile.id);
    setData((d) => ({
      ...d,
      groupes: d.groupes.map((g) => g.id === id ? {
        ...g,
        memberIds: isMember ? (g.memberIds || []).filter((m) => m !== profile.id) : [...(g.memberIds || []), profile.id],
        coAdminIds: isMember ? (g.coAdminIds || []).filter((m) => m !== profile.id) : (g.coAdminIds || []),
      } : g),
    }));
    if (!isMember && group.adminId && group.adminId !== profile.id) {
      notify(`${profile.name} a rejoint votre groupe « ${group.name} ».`, group.adminId);
    }
  };
  const requestJoinGroup = (id) => {
    const group = data.groupes.find((g) => g.id === id);
    if (!group || (group.memberIds || []).includes(profile.id) || (group.joinRequests || []).includes(profile.id)) return;
    setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === id ? { ...g, joinRequests: [...(g.joinRequests || []), profile.id] } : g) }));
    [group.adminId, ...(group.coAdminIds || [])].filter(Boolean).forEach((aid) => notify(`${profile.name} demande à rejoindre le groupe privé « ${group.name} ».`, aid));
  };
  const approveJoinRequest = (groupId, userId) => {
    setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === groupId ? { ...g, memberIds: [...(g.memberIds || []), userId], joinRequests: (g.joinRequests || []).filter((u) => u !== userId) } : g) }));
    notify("Votre demande pour rejoindre le groupe a été acceptée.", userId);
  };
  const rejectJoinRequest = (groupId, userId) => {
    setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === groupId ? { ...g, joinRequests: (g.joinRequests || []).filter((u) => u !== userId) } : g) }));
  };
  const toggleCoAdmin = (groupId, userId) => {
    setData((d) => ({
      ...d,
      groupes: d.groupes.map((g) => {
        if (g.id !== groupId) return g;
        const already = (g.coAdminIds || []).includes(userId);
        return { ...g, coAdminIds: already ? g.coAdminIds.filter((u) => u !== userId) : [...(g.coAdminIds || []), userId] };
      }),
    }));
    notify("Vous êtes désormais co-administrateur d'un groupe.", userId);
  };
  const removeMember = (groupId, userId) => {
    setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === groupId ? { ...g, memberIds: (g.memberIds || []).filter((u) => u !== userId), coAdminIds: (g.coAdminIds || []).filter((u) => u !== userId) } : g) }));
    notify("Vous avez été retiré(e) d'un groupe.", userId);
  };
  const addMemberDirect = (groupId, userId) => {
    const group = data.groupes.find((g) => g.id === groupId);
    if (!group || (group.memberIds || []).includes(userId)) return;
    setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === groupId ? { ...g, memberIds: [...(g.memberIds || []), userId], joinRequests: (g.joinRequests || []).filter((u) => u !== userId) } : g) }));
    notify(`Vous avez été ajouté(e) au groupe « ${group.name} ».`, userId);
  };
  const addGroup = (g) => setData((d) => ({ ...d, groupes: [g, ...d.groupes] }));
  const updateGroup = (id, changes) => setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === id ? { ...g, ...changes } : g) }));
  const deleteGroup = (id) => setData((d) => ({ ...d, groupes: d.groupes.filter((g) => g.id !== id) }));

  const addGroupPost = async (groupId, post) => {
    setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id === groupId ? { ...g, posts: [...(g.posts || []), post] } : g) }));
    const group = data.groupes.find((g) => g.id === groupId);
    if (group?.adminId && group.adminId !== profile.id) notify(`${profile.name} a publié dans le groupe « ${group.name} ».`, group.adminId);
    (post.mentionedIds || []).filter((id) => id !== profile.id).forEach((id) => {
      notify(`${profile.name} vous a mentionné dans le groupe « ${group?.name || "" }».`, id);
    });
  };
  const likeGroupPost = (groupId, postId) => {
    setData((d) => ({
      ...d,
      groupes: d.groupes.map((g) => {
        if (g.id !== groupId) return g;
        return {
          ...g,
          posts: (g.posts || []).map((p) => {
            if (p.id !== postId) return p;
            const already = (p.likedBy || []).includes(profile.id);
            return { ...p, likedBy: already ? p.likedBy.filter((n) => n !== profile.id) : [...(p.likedBy || []), profile.id] };
          }),
        };
      }),
    }));
  };
  const deleteGroupPost = (groupId, postId) => setData((d) => ({ ...d, groupes: d.groupes.map((g) => g.id !== groupId ? g : { ...g, posts: (g.posts || []).filter((p) => p.id !== postId) }) }));

  const sendMessage = async (threadId, msg) => {
    setData((d) => ({ ...d, threads: d.threads.map((t) => t.id === threadId ? { ...t, messages: [...t.messages, msg] } : t) }));
    const thread = data.threads.find((t) => t.id === threadId);
    const otherId = thread?.participantIds?.find((id) => id !== profile.id);
    if (otherId) notify(`Vous avez reçu un nouveau message de ${profile.name}.`, otherId);
  };
  const muteThread = (threadId) => setData((d) => ({ ...d, threads: d.threads.map((t) => t.id === threadId ? { ...t, muted: !t.muted } : t) }));
  const clearThread = (threadId) => setData((d) => ({ ...d, threads: d.threads.map((t) => t.id === threadId ? { ...t, messages: [] } : t) }));
  const pinMessage = (threadId, messageId) => setData((d) => ({ ...d, threads: d.threads.map((t) => t.id === threadId ? { ...t, messages: t.messages.map((m) => m.id === messageId ? { ...m, pinned: !m.pinned } : m) } : t) }));
  const markThreadRead = (threadId) => setData((d) => ({ ...d, threads: d.threads.map((t) => t.id === threadId ? { ...t, lastRead: { ...t.lastRead, [profile.id]: Date.now() } } : t) }));
  const markNotificationsRead = () => setData((d) => ({ ...d, notifications: d.notifications.map((n) => (!n.to || n.to === profile.id) ? { ...n, read: true } : n) }));

  const openChatWith = (authorId, authorName) => {
    if (!authorId || authorId === profile.id) return;
    if ((profile.blockedIds || []).includes(authorId)) return;
    if ((accounts[authorId]?.blockedIds || []).includes(profile.id)) return;
    let thread = data.threads.find((t) => (t.participantIds || []).includes(profile.id) && (t.participantIds || []).includes(authorId));
    if (!thread) {
      thread = { id: uid("t"), participantIds: [profile.id, authorId], lastRead: {}, messages: [] };
      setData((d) => ({ ...d, threads: [thread, ...d.threads] }));
    }
    setOpenThread(thread.id);
    setTab("messagerie");
  };

  const broadcastMessage = (text) => {
    if (!text.trim() || !profile) return;
    const now = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    setData((d) => {
      let threads = [...d.threads];
      const notifs = [];
      Object.values(accounts).forEach((a) => {
        if (a.id === profile.id) return;
        const msg = { id: uid("m"), authorId: profile.id, author: profile.name, text, time: now(), ts: Date.now(), broadcast: true };
        const idx = threads.findIndex((t) => (t.participantIds || []).includes(profile.id) && (t.participantIds || []).includes(a.id));
        if (idx >= 0) {
          threads[idx] = { ...threads[idx], messages: [...threads[idx].messages, msg] };
        } else {
          threads = [{ id: uid("t"), participantIds: [profile.id, a.id], lastRead: {}, messages: [msg] }, ...threads];
        }
        notifs.push({ id: uid("n"), text: `Message de l'administration de ClassPro.`, time: "à l'instant", to: a.id, read: false });
      });
      return { ...d, threads, notifications: [...notifs, ...d.notifications] };
    });
  };

  if (!ready) return <div className="loading">Ouverture de ClassPro…</div>;

  const unreadNotifs = profile ? data.notifications.filter((n) => n.read === false && (!n.to || n.to === profile.id)).length : 0;
  const unreadMessages = profile ? data.threads.reduce((sum, t) => {
    const lastRead = t.lastRead?.[profile.id] || 0;
    return sum + t.messages.filter((m) => m.authorId !== profile.id && (m.ts || 0) > lastRead).length;
  }, 0) : 0;

  return (
    <div className="phone">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        :root {
          --primary:#4F3FF0; --primary-dark:#3A2BC4; --primary-light:#7C6BFF;
          --accent:#FF5C4D; --accent-dark:#E8452F;
          --ink:#15132B; --muted-ink:#68647F;
          --bg:#F3F2FB; --surface:#FFFFFF; --border:#E7E4F6;
        }
        html, body, #root { height:100%; margin:0; padding:0; overflow:hidden; overscroll-behavior:none; }
        .phone { font-family:'Inter',sans-serif; color:var(--ink); width:100%; max-width:430px; margin:0 auto; height:100svh; max-height:900px; background:var(--bg); position:relative; overflow:hidden; border-radius:28px; box-shadow:0 20px 60px rgba(21,19,43,0.28); display:flex; flex-direction:column; transform:translateZ(0); }
        @media (max-width: 480px) {
          .phone { max-width:100%; height:100svh; max-height:none; border-radius:0; box-shadow:none; }
        }
        .loading { display:flex; align-items:center; justify-content:center; height:100vh; font-family:'Inter',sans-serif; color:var(--muted-ink); }

        .app-header { background:linear-gradient(135deg,var(--primary) 0%,var(--primary-light) 100%); padding:18px 18px 16px; flex-shrink:0; }
        .app-header-top { display:flex; align-items:center; justify-content:space-between; }
        .brand { font-family:'Sora',sans-serif; font-size:24px; color:#fff; line-height:1; font-weight:800; letter-spacing:-0.02em; }
        .header-icons { display:flex; gap:6px; }
        .header-icons .icon-btn { background:rgba(255,255,255,0.18); color:#fff; }
        .header-icons .icon-btn:hover { background:rgba(255,255,255,0.28); }
        .header-icons .icon-solid { color:#fff; box-shadow:0 2px 8px rgba(21,19,43,0.25); }
        .header-icons .icon-solid:hover { filter:brightness(1.08); background-color:inherit; }
        .bell-btn { position:relative; }
        .badge-dot { position:absolute; top:-3px; right:-3px; background:var(--accent); color:#fff; font-family:'Inter',sans-serif; font-weight:800; font-size:9px; min-width:16px; height:16px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 3px; border:2px solid var(--primary); }
        .tagline { font-family:'Inter',sans-serif; font-weight:500; font-size:11.5px; color:rgba(255,255,255,0.85); letter-spacing:0.01em; margin-top:2px; }

        .content { flex:1; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; padding-bottom:calc(90px + env(safe-area-inset-bottom, 0px)); }
        .screen { padding:16px 16px 8px; }
        .screen-head { display:flex; align-items:center; justify-content:space-between; margin-bottom:10px; }
        .screen-head h2 { font-family:'Sora',sans-serif; font-weight:800; font-size:21px; color:var(--ink); letter-spacing:-0.02em; }
        .sub-head { font-family:'Sora',sans-serif; font-weight:700; font-size:16px; margin:16px 4px 8px; color:var(--ink); }

        .hero { padding:4px 4px 18px; }
        .hero-eyebrow { font-family:'Inter',sans-serif; font-weight:700; font-size:11px; color:var(--primary); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:3px; }
        .hero-title { font-family:'Sora',sans-serif; font-weight:800; font-size:22px; margin-bottom:12px; letter-spacing:-0.02em; }
        .chat-fab { display:flex; align-items:center; gap:8px; background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; border:none; padding:11px 18px; border-radius:999px; font-family:'Inter'; font-weight:700; font-size:13px; cursor:pointer; box-shadow:0 8px 18px rgba(79,63,240,0.32); }
        .chat-fab:hover { filter:brightness(1.06); }

        .board { display:flex; flex-direction:column; gap:14px; padding:6px 6px 20px; }
        .note { background:var(--surface); border-radius:18px; padding:16px 16px 14px; box-shadow:0 2px 10px rgba(21,19,43,0.06); border:1px solid var(--border); position:relative; }
        .note.unread-note { border-left:3px solid var(--primary); background:#F8F7FF; }
        .note h4 { font-size:15px; font-weight:700; margin:2px 0 4px; display:flex; align-items:center; gap:6px; font-family:'Inter'; }
        .verified { color:var(--accent); display:inline-flex; }
        .verif-pending { color:#C9932E; display:inline-flex; }
        .verif-pending-text { color:#C9932E; }
        .muted { color:var(--muted-ink); font-size:13.5px; line-height:1.45; } .muted.center { text-align:center; } .muted.small { font-size:12px; }
        .meta { display:flex; align-items:center; gap:5px; font-family:'Inter',sans-serif; font-weight:500; font-size:11.5px; color:var(--muted-ink); margin-top:6px; }
        .click-area { cursor:pointer; }
        .post-foot { display:flex; gap:10px; margin-top:12px; }
        .icon-text { display:flex; align-items:center; gap:5px; font-family:'Inter',sans-serif; font-weight:600; font-size:12px; color:var(--muted-ink); background:var(--bg); border:none; cursor:pointer; padding:7px 12px; border-radius:999px; }
        .icon-text:hover { background:var(--border); color:var(--primary); }
        .icon-text.liked { background:#FFE9E5; color:var(--accent-dark); }
        .post-head-row { display:flex; align-items:flex-start; justify-content:space-between; gap:10px; margin-bottom:10px; }
        .post-author-row { display:flex; align-items:center; gap:10px; }
        .post-body { margin-top:2px; }
        .icon-btn.tiny { width:26px; height:26px; background:var(--bg); }
        .post-menu-wrap { position:relative; }
        .post-menu { position:absolute; top:30px; right:0; background:var(--surface); border-radius:12px; box-shadow:0 10px 26px rgba(21,19,43,0.18); overflow:hidden; z-index:5; min-width:150px; border:1px solid var(--border); }
        .post-menu button { display:block; width:100%; text-align:left; padding:10px 14px; background:none; border:none; font-family:'Inter'; font-weight:600; font-size:12.5px; color:var(--ink); cursor:pointer; }
        .post-menu button:hover { background:var(--bg); }
        .post-menu button.danger { color:var(--accent-dark); }
        .edit-post-block textarea { width:100%; border:1.5px solid var(--border); background:var(--bg); border-radius:12px; padding:10px 12px; font-family:'Inter'; font-size:13.5px; outline:none; margin-top:4px; }
        .edit-post-block textarea:focus { border-color:var(--primary); }
        .edit-post-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:8px; }

        .avatar { width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center; color:#fff; font-family:'Sora',sans-serif; font-weight:700; font-size:14px; flex-shrink:0; overflow:hidden; }
        .avatar.sm { width:30px; height:30px; font-size:12px; }
        .avatar.lg { width:58px; height:58px; font-size:20px; }
        .avatar.has-img { background:var(--border); }
        .avatar img { width:100%; height:100%; object-fit:cover; }
        .avatar-row { flex-direction:row !important; align-items:center; gap:12px; }

        .badge { display:inline-block; font-family:'Inter',sans-serif; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:0.04em; padding:4px 10px; border-radius:999px; margin-bottom:6px; }
        .tone-pin { background:#FFE3DE; color:var(--accent-dark); } .tone-sage { background:#E4F7EA; color:#1E8A4C; } .tone-cork { background:#EDEBFB; color:var(--primary); } .tone-ink { background:var(--bg); color:var(--ink); }

        .empty { text-align:center; padding:30px 10px; color:var(--muted-ink); font-size:13px; }
        .error-text { color:var(--accent-dark); font-size:12px; font-weight:600; margin:2px 0 8px; }
        .load-more-btn { display:block; margin:4px auto 18px; background:var(--surface); border:1.5px solid var(--border); color:var(--primary); font-family:'Inter'; font-weight:700; font-size:12.5px; padding:9px 18px; border-radius:999px; cursor:pointer; }
        .load-more-btn:hover { background:var(--bg); }

        .search-row { display:flex; align-items:center; gap:8px; background:var(--surface); border:1.5px solid var(--border); border-radius:14px; padding:10px 14px; margin-bottom:10px; }
        .search-row input { border:none; background:transparent; outline:none; font-size:13.5px; width:100%; font-family:'Inter'; }
        .chip { border:1.5px solid var(--border); background:var(--surface); color:var(--muted-ink); font-family:'Inter'; font-size:12.5px; font-weight:700; padding:7px 14px; border-radius:999px; cursor:pointer; }
        .chip.active { background:var(--primary); color:#fff; border-color:var(--primary); }
        .chip.danger { border-color:var(--accent); color:var(--accent-dark); }
        .chip.danger:hover { background:#FFF1EF; }
        .chip.small { padding:5px 11px; font-size:11px; }
        .filter-chips { display:flex; gap:7px; flex-wrap:wrap; margin-bottom:12px; }
        .auth-toggle { display:flex; gap:8px; justify-content:center; margin:10px 0 14px; }

        .icon-btn { border:none; background:var(--bg); color:var(--ink); width:36px; height:36px; border-radius:50%; display:flex; align-items:center; justify-content:center; cursor:pointer; }
        .icon-btn:hover { background:var(--border); }
        .icon-btn.primary { background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; box-shadow:0 6px 14px rgba(79,63,240,0.3); }
        .icon-btn.primary:hover { filter:brightness(1.08); }
        .icon-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .btn-primary { width:100%; background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; border:none; padding:13px; border-radius:999px; font-weight:700; font-family:'Inter'; font-size:14px; cursor:pointer; margin-top:6px; box-shadow:0 8px 18px rgba(79,63,240,0.3); }
        .btn-primary:hover { filter:brightness(1.06); }
        .btn-primary:disabled { opacity:0.45; cursor:not-allowed; box-shadow:none; }
        .btn-primary.slim { padding:9px 16px; width:auto; margin-top:0; font-size:12.5px; }
        .btn-secondary { width:100%; background:var(--surface); color:var(--primary); border:1.5px solid var(--primary); padding:11px; border-radius:999px; font-weight:700; font-family:'Inter'; font-size:13.5px; cursor:pointer; margin-top:8px; }
        .btn-secondary:hover { background:var(--bg); }
        .btn-danger { width:100%; background:none; border:1.5px solid var(--accent); color:var(--accent-dark); padding:11px; border-radius:999px; font-weight:700; font-family:'Inter'; cursor:pointer; margin-top:10px; display:flex; align-items:center; justify-content:center; gap:6px; font-size:13px; }
        .btn-danger:hover { background:#FFF1EF; }
        .settings-row { width:100%; justify-content:flex-start; gap:8px; margin-bottom:8px; }
        .settings-row.danger { color:var(--accent-dark); border-color:var(--accent); }
        .settings-toggle-row { display:flex; align-items:center; justify-content:space-between; padding:7px 0; font-size:13px; font-weight:500; }
        .danger-confirm-box { background:#FFF6F5; border:1px solid #FFD9D3; border-radius:12px; padding:10px 12px; margin-top:6px; }
        .group-detail-head { display:flex; align-items:center; justify-content:space-between; }
        .thread-head-row { display:flex; align-items:center; justify-content:space-between; }
        .back-btn { display:flex; align-items:center; gap:4px; background:none; border:none; color:var(--muted-ink); font-family:'Inter'; font-weight:600; font-size:13px; margin-bottom:6px; cursor:pointer; padding:0; }

        .group-feed { margin-top:6px; }
        .group-composer { background:var(--surface); border:1px solid var(--border); border-radius:16px; padding:12px; margin-bottom:10px; }
        .group-composer textarea { width:100%; border:1.5px solid var(--border); background:var(--bg); border-radius:12px; padding:10px 12px; font-family:'Inter'; font-size:13.5px; outline:none; }
        .group-composer-actions { display:flex; align-items:center; justify-content:space-between; margin-top:8px; gap:8px; }

        .bottom-nav { position:fixed; left:50%; transform:translateX(-50%); bottom:0; width:100%; max-width:430px; z-index:20; background:var(--surface); border-top:1px solid var(--border); display:flex; justify-content:space-around; padding:10px 4px 14px; padding-bottom:calc(14px + env(safe-area-inset-bottom, 0px)); }
        @media (max-width: 480px) {
          .bottom-nav { max-width:100%; }
        }
        .nav-btn { display:flex; flex-direction:column; align-items:center; gap:3px; background:none; border:none; color:var(--muted-ink); font-family:'Inter'; font-weight:600; font-size:10px; cursor:pointer; padding:4px 10px; border-radius:14px; position:relative; }
        .nav-btn.active { color:var(--primary); background:#EDEBFB; }
        .nav-badge { position:absolute; top:0; right:6px; background:var(--accent); color:#fff; font-size:9px; font-weight:800; min-width:15px; height:15px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 3px; }

        .modal-backdrop { position:fixed; inset:0; background:rgba(21,19,43,0.45); display:flex; align-items:flex-end; z-index:40; }
        .modal-sheet { background:var(--surface); width:100%; border-radius:24px 24px 0 0; padding:18px 18px 24px; max-height:85%; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-bottom:calc(24px + env(safe-area-inset-bottom, 0px)); }
        .modal-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; }
        .modal-head h3 { font-family:'Sora',sans-serif; font-weight:800; font-size:18px; }
        .form-row { margin-bottom:12px; display:flex; flex-direction:column; gap:6px; }
        .form-row.two { flex-direction:row; gap:10px; }
        .form-row.two > div { flex:1; display:flex; flex-direction:column; gap:6px; }
        .form-row label { font-size:11.5px; font-family:'Inter',sans-serif; font-weight:700; color:var(--muted-ink); }
        .form-row input, .form-row select, .form-row textarea { border:1.5px solid var(--border); background:var(--bg); border-radius:12px; padding:10px 12px; font-family:'Inter'; font-size:13.5px; outline:none; }
        .form-row input:focus, .form-row select:focus, .form-row textarea:focus { border-color:var(--primary); background:#fff; }

        .dash-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; padding:6px; }
        .dash-card { background:var(--surface); border-radius:16px; padding:18px 14px; text-align:center; border:1px solid var(--border); }
        .dash-num { font-family:'Sora',sans-serif; font-weight:800; font-size:26px; color:var(--primary); }
        .dash-label { font-family:'Inter',sans-serif; font-weight:600; font-size:10.5px; color:var(--muted-ink); text-transform:uppercase; letter-spacing:0.03em; margin-top:2px; }

        .chat-overlay { position:fixed; inset:0; background:var(--bg); z-index:30; display:flex; flex-direction:column; }
        .chat-overlay .screen { flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch; overscroll-behavior:contain; padding-bottom:calc(24px + env(safe-area-inset-bottom, 0px)); }
        .chat-head { display:flex; align-items:center; gap:10px; padding:16px; border-bottom:1px solid var(--border); flex-shrink:0; background:var(--surface); }
        .chat-head h3 { font-family:'Sora',sans-serif; font-weight:800; font-size:17px; }
        .thread-screen { display:flex; flex-direction:column; height:100%; }
        .chat-messages { flex:1; overflow-y:auto; padding:10px 4px; display:flex; flex-direction:column; gap:12px; }
        .msg { max-width:80%; background:var(--surface); border:1px solid var(--border); padding:9px 13px; border-radius:16px 16px 16px 4px; align-self:flex-start; }
        .msg.mine { align-self:flex-end; background:linear-gradient(135deg,var(--primary),var(--primary-dark)); color:#fff; border:none; border-radius:16px 16px 4px 16px; }
        .msg.mine .msg-meta { color:rgba(255,255,255,0.75); }
        .msg-meta { font-family:'Inter',sans-serif; font-weight:600; font-size:10px; color:var(--muted-ink); margin-bottom:2px; }
        .msg-text { font-size:13.5px; line-height:1.4; }
        .msg-foot-row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-top:2px; }
        .msg-status { display:flex; align-items:center; opacity:0.85; }
        .attach-img { max-width:100%; border-radius:12px; margin-top:8px; display:block; }
        .attach-file { display:flex; align-items:center; gap:6px; background:var(--bg); border-radius:10px; padding:8px 10px; margin-top:8px; font-size:12px; font-family:'Inter'; font-weight:600; color:var(--muted-ink); }
        .attach-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-top:8px; }
        .attach-grid.count-1 { grid-template-columns:1fr; }
        .attach-grid-item .attach-img { margin-top:0; height:100px; width:100%; object-fit:cover; }
        .attach-preview-grid { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; }
        .attach-preview-chip { position:relative; width:70px; }
        .attach-preview-chip .attach-img { width:70px; height:70px; object-fit:cover; margin-top:0; border-radius:10px; }
        .attach-preview-chip .attach-file { width:70px; height:70px; flex-direction:column; text-align:center; justify-content:center; margin-top:0; font-size:9px; word-break:break-all; }
        .attach-preview-chip .icon-btn.tiny { position:absolute; top:-6px; right:-6px; background:var(--surface); box-shadow:0 2px 6px rgba(21,19,43,0.2); width:20px; height:20px; }
        .msg.mine .attach-file { background:rgba(255,255,255,0.18); color:#fff; }
        .attach-preview-row { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:12px; }
        .voice-bubble { display:flex; align-items:center; gap:8px; background:none; border:none; color:inherit; cursor:pointer; margin-top:6px; padding:4px 0; font-family:'Inter'; }
        .voice-wave { letter-spacing:1px; font-size:14px; }
        .voice-duration { font-family:'Inter',sans-serif; font-weight:600; font-size:10px; opacity:0.8; }
        .icon-btn.recording { animation: pulse 1s infinite; }
        @keyframes pulse { 0%,100% { box-shadow:0 0 0 0 rgba(255,92,77,0.5);} 50% { box-shadow:0 0 0 6px rgba(255,92,77,0);} }
        .spin { animation: spin 0.9s linear infinite; }
        @keyframes spin { from { transform:rotate(0deg);} to { transform:rotate(360deg);} }
        .chat-input-row { display:flex; gap:8px; padding:12px 16px 18px; border-top:1px solid var(--border); background:var(--surface); }
        .chat-input-row.static { padding:10px 0 4px; border-top:none; background:none; }
        .chat-input-row input { flex:1; border:1.5px solid var(--border); background:var(--bg); border-radius:999px; padding:10px 15px; outline:none; font-family:'Inter'; font-size:13.5px; }
        .chat-input-row input:focus { border-color:var(--primary); background:#fff; }
        .unread-dot { background:var(--accent); color:#fff; font-size:11px; font-weight:800; min-width:20px; height:20px; border-radius:999px; display:flex; align-items:center; justify-content:center; padding:0 5px; flex-shrink:0; }

        .onboarding { height:100%; display:flex; align-items:center; justify-content:center; padding:24px; overflow-y:auto; background:linear-gradient(150deg,var(--primary) 0%,var(--primary-dark) 100%); }
        .onboarding-card { background:var(--surface); border-radius:24px; padding:28px 22px; box-shadow:0 20px 50px rgba(0,0,0,0.25); text-align:center; width:100%; }
        .onboarding-card .brand { font-size:30px; margin-bottom:2px; color:var(--ink); }
        .onboarding-card .form-row { text-align:left; }
        .verify-box { text-align:center; }
        .verify-box .form-row { text-align:left; }
        .verify-demo-note { background:#FFF6E9; border:1px solid #F0D9A8; border-radius:10px; padding:8px 10px; margin:6px 0 10px; color:#8A6A1F !important; }
        .legal-screen p { margin: 0; }
        .annonce-card { background:linear-gradient(135deg,#FFF3E0,#FFE9D6); border:1px solid #F5CFA0; border-radius:16px; padding:12px 14px; margin-bottom:10px; }
        .comment-section { width:100%; }
        .comment-list { margin-top:10px; display:flex; flex-direction:column; gap:8px; }
        .comment-item { display:flex; align-items:center; gap:6px; flex-wrap:wrap; background:var(--bg); border-radius:12px; padding:7px 10px; font-size:12.5px; }
        .comment-author { font-weight:700; color:var(--primary); }
        .comment-text { color:var(--ink); flex:1; }
        .comment-edited { color:var(--muted-ink); font-size:10.5px; }
        .comment-actions { display:flex; gap:4px; margin-left:auto; }
        .comment-actions button { background:none; border:none; color:var(--muted-ink); cursor:pointer; padding:3px; }
        .comment-actions button:hover { color:var(--accent-dark); }
        .comment-edit-row { display:flex; align-items:center; gap:6px; flex:1; }
        .comment-edit-row input { flex:1; border:1.5px solid var(--border); border-radius:8px; padding:4px 8px; font-family:'Inter'; font-size:12.5px; outline:none; }
        .comment-input-row { display:flex; gap:6px; margin-top:4px; }
        .comment-input-row input { flex:1; border:1.5px solid var(--border); background:var(--surface); border-radius:999px; padding:8px 12px; font-family:'Inter'; font-size:12.5px; outline:none; }
        .annonce-title { font-family:'Sora',sans-serif; font-weight:700; font-size:13px; color:#8A5A1F; margin-bottom:3px; display:flex; align-items:center; }
        .admin-badge { color:#C9932E; display:inline-flex; }
        .admin-tabs { display:flex; gap:6px; overflow-x:auto; padding-bottom:8px; margin-bottom:6px; }
        .admin-stat-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
        .member-row { display:flex; align-items:center; justify-content:space-between; padding:8px 0; border-bottom:1px solid var(--border); gap:8px; }
        .member-row:last-child { border-bottom:none; }
        .group-thread { max-height:46vh; overflow-y:auto; -webkit-overflow-scrolling:touch; padding-right:2px; }
        .group-composer { position:sticky; bottom:-1px; background:var(--bg); padding-top:8px; margin-top:4px; }
        .group-composer-row { display:flex; align-items:center; gap:8px; background:var(--surface); border-radius:999px; padding:6px 6px 6px 14px; box-shadow:0 2px 10px rgba(21,19,43,0.08); }
        .group-composer-row textarea { flex:1; border:none; outline:none; resize:none; font-family:'Inter'; font-size:13px; background:transparent; max-height:70px; padding:6px 0; }
        .mention-tag { color:var(--primary); font-weight:700; background:rgba(79,63,240,0.08); border-radius:4px; padding:0 2px; }
        .mention-dropdown { position:absolute; bottom:calc(100% + 6px); left:8px; right:8px; background:var(--surface); border:1px solid var(--border); border-radius:14px; box-shadow:0 10px 26px rgba(21,19,43,0.18); overflow:hidden; max-height:200px; overflow-y:auto; z-index:5; }
        .mention-option { display:flex; align-items:center; gap:8px; width:100%; padding:8px 12px; border:none; background:none; font-family:'Inter'; font-size:13px; font-weight:600; color:var(--ink); cursor:pointer; text-align:left; }
        .mention-option:hover { background:var(--bg); }
        .quote-block { background:var(--bg); border-left:3px solid var(--primary-light); border-radius:8px; padding:6px 10px; margin-bottom:6px; }
        .quote-author { font-family:'Sora',sans-serif; font-weight:700; font-size:11px; color:var(--primary); margin:0; }
        .quote-text { font-size:12px; color:var(--muted-ink); margin:2px 0 0; }
        .reply-preview { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; background:var(--bg); border-radius:10px; padding:6px 10px; margin-bottom:6px; }
        .invite-link-row { display:flex; align-items:center; gap:8px; background:var(--bg); border-radius:10px; padding:8px 10px; margin-top:8px; }
        .invite-link-row input { flex:1; border:none; background:transparent; font-size:11px; color:var(--muted-ink); outline:none; }
      `}</style>

      {!profile ? (
        <AuthScreen onLogin={login} onSignup={signup} accounts={accounts} onResetPassword={resetPassword} />
      ) : (
        <>
          <div className="app-header">
            <div className="app-header-top">
              <span className="brand">ClassPro</span>
              <div className="header-icons">
                {profile.role === "admin" && (
                  <button className="icon-btn icon-solid" style={{ background: "#C9932E" }} title="Espace administrateur" onClick={() => setOverlay("admin")}><Crown size={16} /></button>
                )}
                <button className="icon-btn icon-solid" style={{ background: "#4F3FF0" }} onClick={() => setOverlay("recherche")}><Search size={16} /></button>
                <button className="icon-btn icon-solid bell-btn" style={{ background: "#E8452F" }} onClick={() => setOverlay("notifications")}>
                  <Bell size={16} />
                  {unreadNotifs > 0 && <span className="badge-dot">{unreadNotifs > 9 ? "9+" : unreadNotifs}</span>}
                </button>
                <button className="icon-btn icon-solid" style={{ background: "#1E8A4C" }} onClick={() => setOverlay("parametres")}><Settings size={16} /></button>
              </div>
            </div>
            <p className="tagline">Le réseau des enseignants du Bénin</p>
          </div>

          <div className="content">
            {tab === "home" && <HomeScreen data={data} profile={profile} accounts={accounts} addPublication={addPublication} likePost={likePost} addComment={addComment} updateComment={updateComment} deleteComment={deleteComment} onOpenChat={openChatWith} updatePublication={updatePublication} deletePublication={deletePublication} addReport={addReport} toggleBlock={toggleBlock} />}
            {tab === "groupes" && <GroupesScreen data={data} accounts={accounts} toggleJoin={toggleJoin} addGroup={addGroup} updateGroup={updateGroup} deleteGroup={deleteGroup} profile={profile} addGroupPost={addGroupPost} likeGroupPost={likeGroupPost} deleteGroupPost={deleteGroupPost} addReport={addReport} toggleBlock={toggleBlock} requestJoinGroup={requestJoinGroup} approveJoinRequest={approveJoinRequest} rejectJoinRequest={rejectJoinRequest} toggleCoAdmin={toggleCoAdmin} removeMember={removeMember} addMemberDirect={addMemberDirect} openGroupId={inviteGroupId} onOpenGroupHandled={() => setInviteGroupId(null)} />}
            {tab === "messagerie" && <MessagerieScreen data={data} accounts={accounts} sendMessage={sendMessage} profile={profile} muteThread={muteThread} clearThread={clearThread} openThread={openThread} setOpenThread={setOpenThread} pinMessage={pinMessage} markThreadRead={markThreadRead} addReport={addReport} toggleBlock={toggleBlock} />}
            {tab === "profil" && <ProfilScreen profile={profile} data={data} updateProfile={updateProfile} exportMyData={exportMyData} deleteAccount={deleteAccount} onLogout={logout} />}
          </div>

          <div className="bottom-nav">
            {[
              ["home", "Accueil", Home, 0, "#4F3FF0"],
              ["groupes", "Groupes", Users, 0, "#1E8A4C"],
              ["messagerie", "Messages", MessageCircle, unreadMessages, "#E8452F"],
              ["profil", "Profil", User, 0, "#C9932E"],
            ].map(([key, label, Icon, badge, color]) => (
              <button key={key} className={`nav-btn ${tab === key ? "active" : ""}`} onClick={() => setTab(key)}>
                <Icon size={20} style={{ color }} />{label}
                {badge > 0 && <span className="nav-badge">{badge > 9 ? "9+" : badge}</span>}
              </button>
            ))}
          </div>

          {overlay === "recherche" && <RechercheOverlay accounts={accounts} data={data} onClose={() => setOverlay(null)} onOpenChat={openChatWith} profile={profile} toggleBlock={toggleBlock} />}
          {overlay === "notifications" && <NotificationsOverlay data={data} onClose={() => setOverlay(null)} profile={profile} markNotificationsRead={markNotificationsRead} />}
          {overlay === "parametres" && <ParametresOverlay profile={profile} onClose={() => setOverlay(null)} onLogout={logout} appSettings={appSettings} updateAppSettings={(c) => setAppSettings((s) => ({ ...s, ...c }))} exportMyData={exportMyData} deleteAccount={deleteAccount} accounts={accounts} toggleBlock={toggleBlock} onOpenLegal={() => setOverlay("mentions")} updateCredentials={updateCredentials} />}
          {overlay === "mentions" && <LegalOverlay onClose={() => setOverlay("parametres")} />}
          {overlay === "admin" && profile.role === "admin" && (
            <AdminOverlay
              data={data}
              accounts={accounts}
              profile={profile}
              onClose={() => setOverlay(null)}
              toggleSuspend={toggleSuspend}
              adminDeleteAccount={adminDeleteAccount}
              setVerification={setVerification}
              resolveReport={resolveReport}
              addAnnonce={addAnnonce}
              deleteAnnonce={deleteAnnonce}
              toggleAnnoncePin={toggleAnnoncePin}
              deletePublication={deletePublication}
              deleteGroupPost={deleteGroupPost}
              deleteGroup={deleteGroup}
              adminDeleteComment={adminDeleteComment}
              broadcastMessage={broadcastMessage}
              approveNameChange={approveNameChange}
              rejectNameChange={rejectNameChange}
            />
          )}
        </>
      )}
    </div>
  );
}
