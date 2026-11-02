import React, { useState, useEffect } from 'react';
import {
  X,
  Bell,
  CheckCheck,
  Check,
  Flame,
  MailCheck,
  Clock,
  ArrowRight,
  Sparkles,
  Inbox,
  Send,
  Eye,
  EyeOff,
  Trash2,
} from 'lucide-react';

export interface NotificationItem {
  id: string;
  type: 'offer' | 'email_sent' | 'system';
  title: string;
  subtitle: string;
  timestamp: string;
  isRead: boolean;
  leadId?: string;
  logId?: string;
  canton?: string;
  price?: string;
  companyName?: string;
}

interface NotificationCenterModalProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: NotificationItem[];
  onMarkAsRead: (id: string) => void;
  onMarkAsUnread: (id: string) => void;
  onMarkAllAsRead: () => void;
  onNavigateToDeals: (leadId?: string) => void;
  onNavigateToEmails: (logId?: string) => void;
  onClearSeenCounters: () => void;
}

export const NotificationCenterModal: React.FC<NotificationCenterModalProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAsRead,
  onMarkAsUnread,
  onMarkAllAsRead,
  onNavigateToDeals,
  onNavigateToEmails,
  onClearSeenCounters,
}) => {
  const [filter, setFilter] = useState<'all' | 'unread' | 'offers' | 'emails'>('all');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.isRead;
    if (filter === 'offers') return n.type === 'offer';
    if (filter === 'emails') return n.type === 'email_sent';
    return true;
  });

  const formatRelativeTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  const handleItemClick = (item: NotificationItem) => {
    if (!item.isRead) {
      onMarkAsRead(item.id);
    }
    if (item.type === 'offer') {
      onClose();
      onNavigateToDeals(item.leadId);
    } else if (item.type === 'email_sent') {
      onClose();
      onNavigateToEmails(item.logId);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-end sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white w-full sm:max-w-md h-full sm:h-auto sm:max-h-[90vh] sm:rounded-3xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden sm:mt-14 sm:mr-4 animate-in slide-in-from-right duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Google Style Header */}
        <div className="p-5 border-b border-slate-200/80 bg-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 text-[#FF6B00] border border-orange-200/80 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-[#FF6B00]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-heading font-bold text-base text-[#0B2240] leading-tight">
                  Activity &amp; Notifications
                </h2>
                {unreadCount > 0 ? (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#FF6B00] text-white">
                    {unreadCount} new
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    All seen
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Live contractor replies, offers &amp; dispatched emails
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action Controls & Filters */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0">
          {/* Segmented Filter Pills */}
          <div className="inline-flex items-center p-0.5 bg-white rounded-xl border border-slate-200 text-xs shrink-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'all'
                  ? 'bg-[#0B2240] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter('unread')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'unread'
                  ? 'bg-[#0B2240] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              Unseen ({unreadCount})
            </button>
            <button
              type="button"
              onClick={() => setFilter('offers')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'offers'
                  ? 'bg-[#0B2240] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              Offers
            </button>
            <button
              type="button"
              onClick={() => setFilter('emails')}
              className={`px-2.5 py-1 rounded-lg font-medium transition-all cursor-pointer whitespace-nowrap ${
                filter === 'emails'
                  ? 'bg-[#0B2240] text-white shadow-2xs'
                  : 'text-slate-600 hover:text-[#0B2240]'
              }`}
            >
              Sent
            </button>
          </div>

          {/* Mark All As Read */}
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={onMarkAllAsRead}
              className="text-[11px] font-semibold text-[#1A73E8] hover:text-[#1557B0] flex items-center gap-1 transition-colors cursor-pointer shrink-0"
              title="Mark all notifications as read and reset counters"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Tout marquer comme lu</span>
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
                <Check className="w-6 h-6 text-emerald-500" />
              </div>
              <div>
                <h4 className="font-heading font-semibold text-sm text-[#0B2240]">
                  All caught up!
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mt-0.5">
                  {filter === 'unread'
                    ? 'No unseen notifications right now.'
                    : 'Activity and contractor responses will appear here as Jimy works.'}
                </p>
              </div>
            </div>
          ) : (
            filteredNotifications.map((item) => {
              const isUnread = !item.isRead;
              return (
                <div
                  key={item.id}
                  onClick={() => handleItemClick(item)}
                  className={`p-4 transition-colors cursor-pointer group flex items-start gap-3 relative ${
                    isUnread
                      ? 'bg-blue-50/40 hover:bg-blue-50/70'
                      : 'hover:bg-slate-50/80 bg-white'
                  }`}
                >
                  {/* Unread Blue Indicator Dot */}
                  {isUnread && (
                    <span
                      className="absolute top-4 right-3 w-2 h-2 rounded-full bg-[#1A73E8]"
                      title="Unseen notification"
                    />
                  )}

                  {/* Icon Avatar */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      item.type === 'offer'
                        ? 'bg-orange-100 text-[#FF6B00]'
                        : item.type === 'email_sent'
                        ? 'bg-blue-50 text-[#1A73E8]'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {item.type === 'offer' ? (
                      <Flame className="w-4 h-4 fill-current" />
                    ) : item.type === 'email_sent' ? (
                      <MailCheck className="w-4 h-4" />
                    ) : (
                      <Sparkles className="w-4 h-4" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-heading font-bold text-xs text-[#0B2240]">
                        {item.title}
                      </span>
                      {item.canton && (
                        <span className="px-1.5 py-0.2 rounded font-mono font-medium text-[10px] bg-slate-100 text-slate-700">
                          {item.canton}
                        </span>
                      )}
                      {item.price && (
                        <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] bg-orange-100/90 text-[#FF6B00]">
                          {item.price}
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-600 line-clamp-2 mt-0.5 leading-relaxed">
                      {item.subtitle}
                    </p>

                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1 tabular-nums">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(item.timestamp)}
                      </span>
                      <span>·</span>
                      <span className="text-[#FF6B00] group-hover:underline font-medium inline-flex items-center gap-0.5">
                        <span>{item.type === 'offer' ? 'Voir l’offre' : 'Voir le courriel'}</span>
                        <ArrowRight className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>

                  {/* Mark as read/unread toggle button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (item.isRead) {
                        onMarkAsUnread(item.id);
                      } else {
                        onMarkAsRead(item.id);
                      }
                    }}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                    title={item.isRead ? 'Mark as unread' : 'Mark as seen'}
                  >
                    {item.isRead ? (
                      <EyeOff className="w-3.5 h-3.5" />
                    ) : (
                      <Eye className="w-3.5 h-3.5 text-[#1A73E8]" />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Google Style Footer: Reset Badge Counters */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <button
            type="button"
            onClick={onClearSeenCounters}
            className="text-[11px] text-slate-500 hover:text-[#0B2240] flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Reset all tab badges and seen counters"
          >
            <CheckCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Réinitialiser les alertes</span>
          </button>

          <span className="text-[11px] text-slate-400">JimiScout Live Feed</span>
        </div>
      </div>
    </div>
  );
};
