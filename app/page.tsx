"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Terminal, AlertCircle, Download, X, Pencil } from 'lucide-react';

/**
 * ------------------------------------------------------------------
 * 类型定义 (TypeScript Interfaces)
 * ------------------------------------------------------------------
 */
interface NodeData {
  id: number;
  messageId: number;
  weight: number;
  offsetX: number;
  offsetY: number;
}

interface Message {
  role: 'ai' | 'user' | 'system';
  content: string;
  id: number;
}

interface Note {
  id: number;
  selectedMessages: Message[];
  reflection: string;
  timestamp: number;
}

interface NodeMapProps {
  nodes: NodeData[];
  activeNodeId: number;
  onNodeClick: (msgId: number) => void;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
}

interface KineticTypewriterProps {
  text: string;
  onComplete?: () => void;
}

interface Style {
  bg: string;
  color: string;
}

/**
 * ------------------------------------------------------------------
 * 视觉风格常量
 * ------------------------------------------------------------------
 */
const COLORS = {
  ACCENT: '#1800F3',           // 克莱因蓝
  BG_PRIMARY: '#FFFFFF',       // 主背景
  BG_SECONDARY: '#F9F9F9',     // 侧边栏背景
  BORDER: '#E5E5E5',           // 细边框颜色
  TEXT_MAIN: '#1A1A1A',        // 主文字色
  TEXT_SUB: '#666666',         // 辅助文字色
  DOT_GRID: '#D0D0D0',         // 点阵颜色
  DOTS: '#D0D0D0',             // 点阵颜色（别名）
  // 向后兼容的别名
  BLUE: '#1800F3',
  BG_BLACK: '#F9F9F9',
  BG_CHAT: '#FFFFFF',
  WHITE: '#1A1A1A',
  PURE_WHITE: '#FFFFFF',
  GRAY: '#666666',
  LIGHT_GRAY: '#666666',
};

const SYSTEM_PROMPT = `
你是一位精通苏格拉底产婆术的思辨导师。
核心规则：
1. 永远不要直接回答用户的问题，永远用一个深刻的反问来回应。
2. 引导用户审视自己的逻辑漏洞、定义模糊处或潜在假设。
3. 保持冷峻、理性、简短（不超过 50 字）。

输出必须是严格的 JSON 格式，不要包含 Markdown 代码块，直接返回 JSON 对象：
{
  "reply": "你的反问内容",
  "analysis": {
    "is_new_topic": true/false, 
    "reasoning": "简短的判断理由"
  }
}
`;

/**
 * ------------------------------------------------------------------
 * 组件：左侧思维节点图
 * ------------------------------------------------------------------
 */
const NodeMap = ({ nodes, activeNodeId, onNodeClick, canvasRef: externalCanvasRef }: NodeMapProps) => {
  const internalCanvasRef = useRef<HTMLCanvasElement>(null);
  const canvasRef = externalCanvasRef || internalCanvasRef;
  const containerRef = useRef<HTMLDivElement>(null);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // 简单的碰撞检测逻辑
    const startX = canvas.width / 2;
    const startY = 80;
    let currentX = startX;
    let currentY = startY;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const size = 12 + (node.weight - 1) * 4; 
      
      const dx = x - currentX;
      const dy = y - currentY;
      
      if (Math.sqrt(dx*dx + dy*dy) < size + 5) {
        onNodeClick(node.messageId);
        return;
      }

      if (i < nodes.length - 1) {
        const nextNode = nodes[i+1];
        currentX += nextNode.offsetX;
        currentY += nextNode.offsetY;
      }
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const resizeCanvas = () => {
      if (container && canvas) {
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        drawMap();
      }
    };

    const drawMap = () => {
      if (!canvas || !ctx) return;

      const w = canvas.width;
      const h = canvas.height;
      
      // 1. 背景
      ctx.fillStyle = COLORS.BG_BLACK;
      ctx.fillRect(0, 0, w, h);

      // 2. 点阵
      ctx.fillStyle = COLORS.DOTS; 
      const gridSize = 30; 
      for (let x = 15; x < w; x += gridSize) {
        for (let y = 15; y < h; y += gridSize) {
          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const startX = w / 2;
      const startY = 80;
      let currentX = startX;
      let currentY = startY;

      // 3. 连线
      ctx.beginPath();
      
      let lineX = startX;
      let lineY = startY;
      
      nodes.forEach((node, index) => {
        if (index > 0) {
           ctx.moveTo(lineX, lineY);
           const nextX = lineX + node.offsetX;
           const nextY = lineY + node.offsetY;
           ctx.lineTo(nextX, nextY);
           lineX = nextX;
           lineY = nextY;
        }
      });
      ctx.strokeStyle = COLORS.BORDER;
      ctx.lineWidth = 0.5;
      ctx.stroke();

      // 4. 节点
      nodes.forEach((node, index) => {
        const isLatest = index === nodes.length - 1;
        const isActive = node.messageId === activeNodeId;
        const radius = 6 + (node.weight - 1) * 2; 

        ctx.fillStyle = isLatest ? COLORS.BLUE : COLORS.PURE_WHITE;
        ctx.beginPath();
        ctx.arc(currentX, currentY, radius, 0, Math.PI * 2);
        ctx.fill();

        if (isLatest) {
          ctx.strokeStyle = COLORS.PURE_WHITE;
          ctx.lineWidth = 1;
          ctx.stroke();
        } else {
          // 白色节点添加深灰色描边
          ctx.strokeStyle = COLORS.TEXT_SUB;
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // 激活节点高亮效果
        if (isActive) {
          ctx.strokeStyle = COLORS.BLUE;
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(currentX, currentY, radius + 3, 0, Math.PI * 2);
          ctx.stroke();
        }

        ctx.fillStyle = isLatest ? COLORS.WHITE : COLORS.BG_BLACK;
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        if (radius > 8) {
           ctx.fillText((index + 1).toString(), currentX, currentY);
        }

        if (index < nodes.length - 1) {
          const nextNode = nodes[index + 1];
          currentX += nextNode.offsetX;
          currentY += nextNode.offsetY;
        }
      });
    };

    // Initial draw
    resizeCanvas();

    // Use ResizeObserver to detect container size changes (e.g., from drag resizing)
    const resizeObserver = new ResizeObserver(() => {
      resizeCanvas();
    });
    resizeObserver.observe(container);

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      resizeObserver.disconnect();
    };
  }, [nodes, activeNodeId]);

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-white cursor-crosshair">
      <canvas ref={canvasRef} className="block" onClick={handleClick} />
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * 组件：动态打字机
 * ------------------------------------------------------------------
 */
const KineticTypewriter = ({ text, onComplete }: KineticTypewriterProps) => {
  const chars = useMemo(() => Array.from(text), [text]);
  
  const { groupMapping, groupCount } = useMemo(() => {
    const mapping: number[] = [];
    let count = 0;
    let i = 0;
    while (i < chars.length) {
      // 确保每个色块至少覆盖2个字母
      const remaining = chars.length - i;
      const minSize = Math.min(2, remaining); // 至少2个，但如果剩余不足2个则使用剩余数量
      const maxSize = remaining >= 3 ? 4 : remaining; // 最多4个，但如果剩余不足则使用剩余数量
      const size = Math.floor(Math.random() * (maxSize - minSize + 1)) + minSize;
      for (let j = 0; j < size && i < chars.length; j++) {
        mapping.push(count);
        i++;
      }
      count++;
    }
    return { groupMapping: mapping, groupCount: count };
  }, [chars]);

  const [visibleCount, setVisibleCount] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  
  const [groupStyles, setGroupStyles] = useState<Style[]>(() => 
    new Array(groupCount).fill({ bg: COLORS.GRAY, color: 'white' })
  );

  useEffect(() => {
    if (visibleCount < chars.length) {
      const timeout = setTimeout(() => {
        setVisibleCount(prev => prev + 1);
      }, Math.random() * 50 + 30); // 速度与原版保持一致 (30-80ms)
      return () => clearTimeout(timeout);
    } else {
      if (!isComplete) {
        setIsComplete(true);
        if (onComplete) onComplete();
      }
    }
  }, [visibleCount, chars.length, isComplete, onComplete]);

  useEffect(() => {
    if (isComplete) return;
    const interval = setInterval(() => {
      setGroupStyles(prev => prev.map(() => {
        const r = Math.random();
        // 25% 透明 / 25% 蓝色 / 25% 白色 / 25% 黑色
        if (r > 0.75) return { bg: 'transparent', color: COLORS.TEXT_MAIN };
        if (r > 0.50) return { bg: COLORS.BLUE, color: COLORS.BG_PRIMARY };
        if (r > 0.25) return { bg: COLORS.PURE_WHITE, color: COLORS.TEXT_MAIN };
        return { bg: '#000000', color: COLORS.BG_PRIMARY };
      }));
    }, 350); 
    return () => clearInterval(interval);
  }, [isComplete]);

  return (
    <span className="leading-relaxed break-words">
      {chars.slice(0, visibleCount).map((char, i) => {
        const groupID = groupMapping[i];
        let style = groupStyles[groupID];
        const isBorn = !isComplete && i >= visibleCount - 3; 

        if (isBorn) { style = { bg: COLORS.TEXT_SUB, color: COLORS.BG_PRIMARY }; }
        if (isComplete) { style = { bg: 'transparent', color: COLORS.TEXT_MAIN }; }

        return (
          <span 
            key={i} 
            style={{ 
              backgroundColor: style.bg, 
              color: style.color, 
              transition: isComplete ? 'all 0.5s ease-out' : 'none' 
            }}
          >
            {char}
          </span>
        );
      })}
      {!isComplete && (
        <span className="inline-block w-2.5 h-5 bg-[#1800F3] animate-pulse align-sub ml-0.5 shadow-[0_0_8px_#1800F3]" />
      )}
    </span>
  );
};

/**
 * ------------------------------------------------------------------
 * 组件：欢迎覆盖层
 * ------------------------------------------------------------------
 */
interface WelcomeOverlayProps {
  isStarted: boolean;
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSend: (e: React.FormEvent) => void;
  isThinking: boolean;
}

const WelcomeOverlay = ({ isStarted, inputValue, setInputValue, handleSend, isThinking }: WelcomeOverlayProps) => {
  const welcomeText = "The limits of my language mean the limits of my world. Engage in dialogue and reflection.";

  return (
    <div 
      className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-500 ${isStarted ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
      style={{ backgroundColor: COLORS.BG_CHAT, zIndex: 50 }}
    >
      <div className="max-w-4xl px-8 w-full">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-serif text-white mb-16 leading-relaxed">
            <KineticTypewriter text={welcomeText} />
          </h1>
          <p className="text-sm font-mono text-[#BCBCBC] animate-pulse mb-8">
            [System Awaiting Initial Input]
          </p>
        </div>
        
        <form onSubmit={handleSend} className="relative group max-w-2xl mx-auto">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Terminal size={20} color={COLORS.TEXT_SUB} />
          </div>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="在此输入你的启动语句..."
            className="block w-full pl-12 pr-12 py-3 bg-[#F9F9F9] border border-[#E5E5E5] text-[#1A1A1A] placeholder-[#666666] focus:outline-none focus:border-[#1800F3] focus:ring-0 text-lg transition-all font-mono rounded-xl"
            autoFocus
          />
          <button 
            type="submit"
            disabled={!inputValue.trim() || isThinking}
            className="absolute inset-y-0 right-0 px-6 bg-[#1800F3] text-white hover:opacity-90 transition-opacity disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center rounded-r-xl"
          >
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
};

/**
 * ------------------------------------------------------------------
 * 主应用组件
 * ------------------------------------------------------------------
 */
export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  
  const [nodes, setNodes] = useState<NodeData[]>([]);
  const [activeNodeId, setActiveNodeId] = useState<number>(1);

  const [inputValue, setInputValue] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(450);
  const [isMounted, setIsMounted] = useState(false);
  const [notesWidth, setNotesWidth] = useState(300);
  const [notes, setNotes] = useState<Note[]>([]);
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<number>>(new Set());
  const [isMountedNotes, setIsMountedNotes] = useState(false);
  const [personalNoteInput, setPersonalNoteInput] = useState('');
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedNoteForModal, setSelectedNoteForModal] = useState<Note | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const nodeMapCanvasRef = useRef<HTMLCanvasElement>(null);
  const resizingType = useRef<'left' | 'right' | null>(null);
  const asideRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  const scrollToMessage = (msgId: number) => {
    const el = document.getElementById(`msg-${msgId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const toggleMessageSelection = (messageId: number) => {
    setSelectedMessageIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleEnterSelectionMode = (messageId: number) => {
    setSelectionMode(true);
    setSelectedMessageIds(new Set([messageId]));
  };

  const handleSynthesizeToCard = () => {
    if (selectedMessageIds.size === 0) return;
    
    const selectedMessages = Array.from(selectedMessageIds)
      .map(msgId => messages.find(m => m.id === msgId))
      .filter((msg): msg is Message => msg !== undefined);
    
    if (selectedMessages.length === 0) return;
    
    const newNote: Note = {
      id: Date.now(),
      selectedMessages,
      reflection: '',
      timestamp: Date.now()
    };
    
    setNotes(prev => [...prev, newNote]);
    setSelectedMessageIds(new Set());
    setSelectionMode(false);
  };

  const handleCancelSelection = () => {
    setSelectedMessageIds(new Set());
    setSelectionMode(false);
  };

  const handleDeleteNote = (noteId: number) => {
    setNotes(prev => prev.filter(note => note.id !== noteId));
  };

  const handleNoteClick = (note: Note) => {
    setSelectedNoteForModal(note);
    // 如果有选中的消息，滚动到第一条消息
    if (note.selectedMessages.length > 0) {
      const firstMessageId = note.selectedMessages[0].id;
      scrollToMessage(firstMessageId);
      setActiveNodeId(firstMessageId);
    }
  };

  const handleReflectionChange = (noteId: number, reflection: string) => {
    setNotes(prev => prev.map(note => 
      note.id === noteId ? { ...note, reflection } : note
    ));
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    setIsMounted(true);
    setIsMountedNotes(true);
    if (typeof window !== 'undefined') {
      // 三栏比例 1:2:1
      setSidebarWidth(window.innerWidth * 0.25);  // 左侧 25%
      setNotesWidth(window.innerWidth * 0.25);    // 右侧 25%，中间自动占50%
    }
  }, []);

  useEffect(() => {
    if (isMounted) {
      window.dispatchEvent(new Event('resize'));
    }
  }, [sidebarWidth, notesWidth, isMounted]);

  const startResizing = (type: 'left' | 'right') => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizingType.current = type;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingType.current) return;
      
      if (resizingType.current === 'left') {
        const minWidth = 250;
        const maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.7 : 1200;
        const newWidth = Math.min(Math.max(e.clientX, minWidth), maxWidth);
        setSidebarWidth(newWidth);
      } else if (resizingType.current === 'right') {
        const minWidth = 200;
        const maxWidth = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 800;
        const windowWidth = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const newWidth = Math.min(Math.max(windowWidth - e.clientX, minWidth), maxWidth);
        setNotesWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      if (resizingType.current) {
        resizingType.current = null;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const exportToHTML = () => {
    // 1. Canvas 捕获
    const canvas = nodeMapCanvasRef.current;
    if (!canvas) {
      alert('节点图未就绪');
      return;
    }
    const canvasImage = canvas.toDataURL('image/png');

    // 2. 关键问题提取
    const initialInquiry = messages.find(m => m.role === 'user')?.content || '（未记录初始问题）';
    const finalFrontier = messages.filter(m => m.role === 'ai').pop()?.content || '（未完成对话）';

    // 3. 数据整理
    const exportMessages = messages;
    const exportNotes = notes;
    const exportDate = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 4. HTML 模板构建
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Socratic AI - 思维快照</title>
  <style>
    :root {
      --bg-primary: #FFFFFF;
      --bg-sub: #F9F9F9;
      --border: #E5E5E5;
      --blue: #1800F3;
      --text-main: #1A1A1A;
      --text-sub: #666666;
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', sans-serif;
      background-color: var(--bg-sub);
      color: var(--text-main);
      line-height: 1.6;
      padding: 32px;
    }

    .card {
      background-color: var(--bg-primary);
      border-radius: 12px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      max-width: 900px;
      margin: 0 auto;
      overflow: hidden;
    }

    .card-header {
      padding: 32px;
      border-bottom: 1px solid var(--border);
    }

    .card-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--blue);
      letter-spacing: 0.5px;
      margin-bottom: 24px;
      text-transform: uppercase;
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    }

    .summary-item {
      margin-bottom: 20px;
      padding-left: 16px;
      border-left: 2px solid var(--border);
    }

    .summary-item:last-child {
      margin-bottom: 0;
    }

    .summary-label {
      font-size: 11px;
      color: var(--text-sub);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 8px;
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    }

    .summary-content {
      font-size: 15px;
      color: var(--text-main);
      line-height: 1.6;
    }

    .summary-content.initial {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
    }

    .summary-content.final {
      font-family: Georgia, 'Times New Roman', serif;
    }

    .card-body {
      padding: 32px;
    }

    details {
      margin-bottom: 24px;
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }

    details:last-child {
      margin-bottom: 0;
    }

    summary {
      padding: 16px 20px;
      background-color: var(--bg-sub);
      cursor: pointer;
      font-weight: 500;
      font-size: 14px;
      color: var(--text-main);
      user-select: none;
      border-bottom: 1px solid var(--border);
    }

    summary:hover {
      background-color: #F5F5F5;
    }

    details[open] summary {
      border-bottom: 1px solid var(--border);
    }

    .details-content {
      padding: 24px;
      background-color: var(--bg-primary);
    }

    .node-map-container {
      text-align: center;
      padding: 20px 0;
    }

    .node-map-image {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .dialogue-container {
      margin-bottom: 32px;
    }

    .dialogue-ai,
    .dialogue-user {
      margin-bottom: 20px;
      display: flex;
      align-items: flex-start;
    }

    .dialogue-ai {
      justify-content: flex-start;
    }

    .dialogue-user {
      justify-content: flex-end;
    }

    .dialogue-bubble {
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 12px;
      position: relative;
    }

    .dialogue-ai .dialogue-bubble {
      background-color: transparent;
      padding-left: 24px;
      border-left: 2px solid var(--blue);
      font-family: Georgia, 'Times New Roman', serif;
      font-size: 15px;
      line-height: 1.7;
      color: var(--text-main);
    }

    .dialogue-user .dialogue-bubble {
      background-color: var(--bg-sub);
      border: 1px solid var(--border);
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
      font-size: 14px;
      color: var(--text-main);
    }

    .notes-container {
      margin-top: 32px;
      padding-top: 32px;
      border-top: 1px solid var(--border);
    }

    .notes-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-main);
      margin-bottom: 16px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    }

    .note-item {
      margin-bottom: 16px;
      padding: 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background-color: var(--bg-primary);
    }

    .note-item:last-child {
      margin-bottom: 0;
    }

    .note-ai {
      border-left: 3px solid var(--blue);
    }

    .note-personal {
      border-left: 3px solid var(--text-sub);
    }

    .note-header {
      font-size: 11px;
      color: var(--blue);
      margin-bottom: 8px;
      font-family: 'SF Mono', 'Monaco', 'Courier New', monospace;
    }

    .note-content {
      font-size: 13px;
      color: var(--text-main);
      line-height: 1.6;
      margin-bottom: 8px;
    }

    .note-reflection {
      font-size: 12px;
      color: var(--text-sub);
      font-style: italic;
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--border);
    }

    .note-meta {
      font-size: 10px;
      color: var(--text-sub);
      margin-top: 8px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="card-header">
      <div class="card-title">SYNTHESIS REPORT // ${exportDate}</div>
      
      <div class="summary-item">
        <div class="summary-label">初始问题</div>
        <div class="summary-content initial">${initialInquiry}</div>
      </div>
      
      <div class="summary-item">
        <div class="summary-label">最终思辨</div>
        <div class="summary-content final">${finalFrontier}</div>
      </div>
    </div>

    <div class="card-body">
      <details>
        <summary>思维地图 (Topology Map)</summary>
        <div class="details-content">
          <div class="node-map-container">
            <img src="${canvasImage}" alt="Node Map" class="node-map-image" />
          </div>
        </div>
      </details>

      <details open>
        <summary>详细记录与合成笔记 (Transcript & Notes)</summary>
        <div class="details-content">
          <div class="dialogue-container">
            ${exportMessages.map(msg => `
              <div class="dialogue-${msg.role === 'ai' ? 'ai' : 'user'}">
                <div class="dialogue-bubble">
                  ${msg.content.replace(/\n/g, '<br>')}
                </div>
              </div>
            `).join('')}
          </div>

          ${exportNotes.length > 0 ? `
            <div class="notes-container">
              <div class="notes-title">合成笔记</div>
              ${exportNotes.map(note => `
                <div class="note-item note-ai">
                  <div class="note-header">${note.selectedMessages.length} 条逻辑片段 • ${note.reflection.length} 字感想</div>
                  <div class="note-content">
                    ${note.selectedMessages.slice(0, 2).map(m => m.content.substring(0, 50)).join(' • ')}
                    ${note.selectedMessages.length > 2 ? '...' : ''}
                  </div>
                  ${note.reflection ? `
                    <div class="note-reflection">${note.reflection}</div>
                  ` : ''}
                  <div class="note-meta">${new Date(note.timestamp).toLocaleString('zh-CN')}</div>
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </details>
    </div>
  </div>
</body>
</html>`;

    // 5. 下载执行
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `socratic-snapshot-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    const userMsgId = Date.now();
    const userMsg: Message = { role: 'user', content: inputValue, id: userMsgId };
    
    let currentMessages = messages;
    
    if (!isStarted) {
      setIsStarted(true);
      
      // 只添加用户消息，作为聊天的第一句
      setMessages([userMsg]);
      currentMessages = [userMsg];
    } else {
      setMessages(prev => [...prev, userMsg]);
      currentMessages = [...messages, userMsg];
    }
    
    setInputValue('');
    setIsThinking(true);
    setError(null);

    try {
      const apiMessages = [
        { role: "system", content: SYSTEM_PROMPT },
        ...currentMessages.map(m => ({ 
          role: m.role === 'ai' ? 'assistant' : 'user', 
          content: m.content 
        }))
      ];

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Network error');
      }

      const data = await response.json();
      const aiResponseContent = data.reply || "（沉默）"; 
      const isNewTopic = data.analysis?.is_new_topic || false;

      const aiMsgId = Date.now() + 1;
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: aiResponseContent, 
        id: aiMsgId 
      }]);

      setNodes(prev => {
        const newNodes = [...prev];
        const lastNode = newNodes[newNodes.length - 1];

        if (isNewTopic || newNodes.length === 0) {
          const randomOffsetX = (Math.random() - 0.5) * 80; 
          const offsetY = 60 + Math.random() * 40; 
          
          newNodes.push({
            id: userMsgId, 
            messageId: userMsgId, 
            weight: 1,
            offsetX: randomOffsetX,
            offsetY: offsetY
          });
        } else if (lastNode) {
          lastNode.weight += 1;
        }
        return newNodes;
      });

    } catch (err) {
      console.error("API Call Failed:", err);
      setError("连接中断，请检查 DeepSeek API 配置");
      setMessages(prev => [...prev, { 
        role: 'ai', 
        content: "思维连接中断...", 
        id: Date.now() 
      }]);
    } finally {
      setIsThinking(false);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden font-mono selection:bg-[#1800F3] selection:text-white bg-white text-[#1A1A1A]">
      
      <aside 
        ref={asideRef}
        className={`h-full hidden md:block relative bg-[#F9F9F9] transition-opacity duration-300 rounded-xl blackboard-dots ${!isMounted ? 'opacity-0' : 'opacity-100'}`}
        style={{ width: isMounted ? sidebarWidth : 450 }}
      >
        <button
          onClick={exportToHTML}
          disabled={isThinking || !isStarted}
          className="absolute top-6 right-6 z-10 flex items-center gap-2 px-4 py-2 bg-white text-[#1A1A1A] border border-[#E5E5E5] font-mono text-xs tracking-widest rounded-full hover:text-[#1800F3] transition-colors disabled:bg-gray-100 disabled:text-gray-400 disabled:border-gray-200 disabled:cursor-not-allowed"
        >
          <Download size={14} />
          <span>导出快照</span>
        </button>
        <NodeMap 
          nodes={nodes} 
          activeNodeId={activeNodeId} 
          onNodeClick={scrollToMessage}
          canvasRef={nodeMapCanvasRef}
        />
      </aside>

      <div
        className="h-full bg-transparent hover:bg-[#1800F3]/30 cursor-col-resize hidden md:block transition-colors select-none flex-shrink-0 relative z-20 rounded-full"
        onMouseDown={startResizing('left')}
        style={{ width: '4px' }}
      />

      <main className="flex-1 flex flex-col relative rounded-xl" style={{ backgroundColor: COLORS.BG_PRIMARY }}>
        
        <WelcomeOverlay 
          isStarted={isStarted}
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSend={handleSend}
          isThinking={isThinking}
        />
        
        <div className={`flex-1 overflow-y-auto p-8 md:p-12 space-y-12 relative z-10 scrollbar-hide pt-16 transition-opacity duration-500 grainy-texture ${!isStarted ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          {messages.map((msg, idx) => (
            <div 
              key={msg.id} 
              id={`msg-${msg.id}`} 
              className="flex flex-col"
            >
              <div 
                className={`flex items-center gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
              >
                {/* AI消息：左侧复选框（仅在selectionMode下显示） */}
                {msg.role === 'ai' && (
                  <div
                    className={`flex-shrink-0 transition-all duration-300 flex items-center ${
                      selectionMode 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 -translate-x-4 pointer-events-none w-0'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMessageIds.has(msg.id)}
                      onChange={() => toggleMessageSelection(msg.id)}
                      className="w-[15px] h-[15px] rounded-full cursor-pointer appearance-none border-[0.5px] border-[#E5E5E5] checked:bg-[#1800F3] checked:border-[#1800F3] transition-all hover:border-[#1800F3]"
                    />
                  </div>
                )}
                
              <div 
                className={`
                  relative max-w-[90%] md:max-w-[85%]
                  ${msg.role === 'ai' 
                    ? 'bg-transparent pl-6' 
                    : 'bg-[#F9F9F9] text-[#1A1A1A] p-4 rounded-xl border border-[#E5E5E5]'} 
                `}
              >
                {msg.role === 'ai' && (
                  <div className="absolute left-0 top-1.5 w-[0.5px] h-5 bg-[#1800F3]"></div>
                )}

                <div className={`text-lg md:text-xl leading-relaxed ${msg.role === 'ai' ? 'font-serif text-[#1A1A1A]' : 'font-mono'}`}>
                    {msg.role === 'ai' && idx === messages.length - 1 ? (
                      <KineticTypewriter text={msg.content} />
                    ) : (
                      <span>{msg.content}</span>
                    )}
                  </div>
                </div>

                {/* User消息：右侧复选框（仅在selectionMode下显示） */}
                {msg.role === 'user' && (
                  <div
                    className={`flex-shrink-0 transition-all duration-300 ${
                      selectionMode 
                        ? 'opacity-100 translate-x-0' 
                        : 'opacity-0 translate-x-4 pointer-events-none w-0'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedMessageIds.has(msg.id)}
                      onChange={() => toggleMessageSelection(msg.id)}
                      className="w-[15px] h-[15px] rounded-full cursor-pointer appearance-none border-[0.5px] border-[#E5E5E5] checked:bg-[#1800F3] checked:border-[#1800F3] transition-all hover:border-[#1800F3] mt-1"
                    />
                  </div>
                )}
              </div>

              {/* Pencil图标：显示在气泡下方（外部），常态显示，用于摘录/编辑 */}
              {!selectionMode && (
                <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} mt-2`}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEnterSelectionMode(msg.id);
                    }}
                    className="flex items-center justify-center cursor-pointer"
                  >
                    <Pencil 
                      size={14} 
                      className="text-[#666666]" 
                    />
                  </button>
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="flex items-center gap-2 text-red-500 text-sm px-4 justify-center">
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {isThinking && (
            <div className="flex flex-col items-start animate-pulse">
              <span className="text-[10px] font-bold mb-1 px-2 py-1 bg-transparent text-[#666666] w-fit">PROCESSING</span>
              <div className="p-4 border border-dashed border-[#1800F3] text-[#1800F3] font-mono text-sm bg-transparent rounded-xl">
                 {">>>"} ANALYZING LOGIC GAPS...
              </div>
            </div>
          )}
          
          {selectionMode && (
            <div className="fixed bottom-24 left-1/2 transform -translate-x-1/2 z-30 flex items-center gap-3 bg-white border border-[#E5E5E5] rounded-xl px-4 py-2 shadow-sm">
              <span className="text-sm font-mono text-[#666666]">
                已选中 {selectedMessageIds.size} 条逻辑片段
              </span>
              <button
                onClick={handleSynthesizeToCard}
                disabled={selectedMessageIds.size === 0}
                className="px-4 py-1.5 text-[#1A1A1A] font-mono text-xs hover:text-[#1800F3] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                [合成卡片]
              </button>
              <button
                onClick={handleCancelSelection}
                className="px-4 py-1.5 text-[#666666] font-mono text-xs hover:text-[#1A1A1A] transition-colors"
              >
                [取消]
              </button>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <footer className="p-5 border-t border-[#E5E5E5] z-20 bg-white">
          <form onSubmit={handleSend} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <Terminal size={20} color={COLORS.TEXT_SUB} />
            </div>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={isStarted ? "在此输入你的回答..." : "在此输入你的启动语句..."}
              className="block w-full pl-12 pr-12 py-3 bg-[#F9F9F9] border border-[#E5E5E5] text-[#1A1A1A] placeholder-[#666666] focus:outline-none focus:border-[#1800F3] focus:ring-0 text-lg transition-all font-mono rounded-xl"
            />
            <button 
              type="submit"
              disabled={!inputValue.trim() || isThinking}
              className="absolute inset-y-0 right-0 px-6 bg-[#1800F3] text-white hover:opacity-90 transition-opacity disabled:bg-gray-200 disabled:text-gray-400 flex items-center justify-center rounded-r-xl"
            >
              <Send size={18} />
            </button>
          </form>
          <div className="mt-2 text-center">
            <p className="text-[10px] text-[#666666] uppercase tracking-[0.2em]">
              Interaction Design Coursework © 2024
            </p>
          </div>
        </footer>
      </main>

      <div
        className="h-full bg-transparent hover:bg-[#1800F3]/30 cursor-col-resize hidden md:block transition-colors select-none flex-shrink-0 relative z-20 rounded-full"
        onMouseDown={startResizing('right')}
        style={{ width: '4px' }}
      />

      <aside 
        className={`h-full hidden md:block relative flex flex-col transition-opacity duration-300 rounded-xl blackboard-dots ${!isMountedNotes ? 'opacity-0' : 'opacity-100'}`}
        style={{ 
          width: isMountedNotes ? notesWidth : 300, 
          backgroundColor: '#F9F9F9'
        }}
      >
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {notes.map(note => {
            const previewText = note.selectedMessages
              .slice(0, 2)
              .map(msg => msg.content.substring(0, 20))
              .join(' • ');
            const messageCount = note.selectedMessages.length;
            const reflectionLength = note.reflection.length;
            
            return (
              <div
                key={note.id}
                onClick={() => handleNoteClick(note)}
                className="p-4 border border-[#E5E5E5] cursor-pointer transition-all hover:shadow-sm rounded-xl bg-white"
              >
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="flex-1">
                    <div className="text-xs font-mono text-[#1800F3] mb-1">
                      {messageCount} 条消息 • {reflectionLength} 字感想
                    </div>
                    <p className="text-sm text-[#1A1A1A] font-mono leading-relaxed line-clamp-2">
                      {previewText}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteNote(note.id);
                    }}
                    className="text-[#666666] hover:text-[#1A1A1A] transition-colors flex-shrink-0 rounded-full p-1 hover:bg-[#F9F9F9]"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            );
          })}
          {notes.length === 0 && (
            <div className="text-center text-[#666] text-xs font-mono mt-8">
              No cards yet
            </div>
          )}
        </div>
      </aside>

      {/* 思辨卡片详情模态框 */}
      {selectedNoteForModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20"
          onClick={() => setSelectedNoteForModal(null)}
        >
          <div 
            className="max-w-6xl w-full h-[90vh] flex flex-col bg-white border border-[#E5E5E5] rounded-xl shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-6 border-b border-[#E5E5E5]">
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono px-3 py-1.5 rounded-full bg-[#F9F9F9] text-[#1800F3] border border-[#E5E5E5]">
                  {selectedNoteForModal.selectedMessages.length} 条逻辑片段
                </span>
                <span className="text-xs font-mono text-[#666666]">
                  {new Date(selectedNoteForModal.timestamp).toLocaleString('zh-CN')}
                </span>
              </div>
              <button
                onClick={() => setSelectedNoteForModal(null)}
                className="text-[#666666] hover:text-[#1A1A1A] transition-colors rounded-full p-2 hover:bg-[#F9F9F9]"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
              {/* 对话复现区 */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4 border-b md:border-b-0 md:border-r border-[#E5E5E5]">
                <h3 className="text-sm font-mono text-[#1800F3] mb-4">对话复现</h3>
                {selectedNoteForModal.selectedMessages.map((msg, idx) => (
                  <div 
                    key={msg.id}
                    className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div 
                      className={`
                        relative max-w-[85%]
                        ${msg.role === 'ai' 
                          ? 'bg-transparent pl-6' 
                          : 'bg-[#F9F9F9] text-[#1A1A1A] p-4 rounded-xl border border-[#E5E5E5]'} 
                      `}
                    >
                      {msg.role === 'ai' && (
                        <div className="absolute left-0 top-1.5 w-[0.5px] h-5 bg-[#1800F3]"></div>
                      )}
                      <div className={`text-base leading-relaxed ${msg.role === 'ai' ? 'font-serif text-[#1A1A1A]' : 'font-mono'}`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 感想撰写区 */}
              <div className="flex-1 flex flex-col p-6">
                <h3 className="text-sm font-mono text-[#1800F3] mb-4">终极感想</h3>
                <textarea
                  value={selectedNoteForModal.reflection}
                  onChange={(e) => {
                    const updatedNote = { ...selectedNoteForModal, reflection: e.target.value };
                    setSelectedNoteForModal(updatedNote);
                    handleReflectionChange(selectedNoteForModal.id, e.target.value);
                  }}
                  placeholder="针对这组对话写下你的思考..."
                  className="flex-1 w-full p-4 bg-[#F9F9F9] border border-[#E5E5E5] text-[#1A1A1A] placeholder-[#666666] focus:outline-none focus:border-[#1800F3] font-mono text-sm rounded-xl transition-all resize-none"
                />
                <div className="mt-2 text-xs font-mono text-[#666666] text-right">
                  {selectedNoteForModal.reflection.length} 字
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}