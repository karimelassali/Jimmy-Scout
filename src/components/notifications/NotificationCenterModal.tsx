import React, { useState } from 'react';
import { Badge } from '@astryxdesign/core/Badge';
import { Button } from '@astryxdesign/core/Button';
import { Drawer, DrawerHeader } from '@astryxdesign/core/Drawer';
import { EmptyState } from '@astryxdesign/core/EmptyState';
import { IconButton } from '@astryxdesign/core/IconButton';
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl';
import {
  CheckCheck,
  Check,
  Flame,
  MailCheck,
  Clock,
  ArrowRight,
  Sparkles,
  Eye,
  EyeOff,
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

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const offersCount = notifications.filter((n) => n.type === 'offer').length;
  const emailsCount = notifications.filter((n) => n.type === 'email_sent').length;

  // Each filter keeps only its own type. At the QA check all 8 notifications
  // were offers (no sent-email notifications existed), so « Offres » rightly
  // showed the same 8 as « Tout » — the counts on the pills now make that
  // visible instead of looking like the filter did nothing.
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

      if (diffMins < 1) return 'À l’instant';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return `${diffDays}d ago`;
    } catch {
      return 'Récemment';
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
    <Drawer
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      side="end"
      width={460}
      padding={0}
      label="Activité et alertes"
    >
      <div className="flex flex-col h-full bg-white">
        <div className="px-5 pt-4 pb-2 border-b border-slate-200/80">
          <DrawerHeader
            title="Activité et alertes"
            subtitle="Réponses des vendeurs, offres et courriels envoyés"
            onOpenChange={(open) => {
              if (!open) onClose();
            }}
            endContent={
              unreadCount > 0 ? (
                <Badge label={`${unreadCount} nouv.`} variant="orange" />
              ) : (
                <Badge label="À jour" variant="green" />
              )
            }
          />
        </div>

        {/* Action Controls & Filters */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <SegmentedControl
            label="Filtrer les notifications"
            size="sm"
            value={filter}
            onChange={(val) =>
              setFilter(val as 'all' | 'unread' | 'offers' | 'emails')
            }
          >
            <SegmentedControlItem value="all" label={`Tout (${notifications.length})`} />
            <SegmentedControlItem value="unread" label={`Non lus (${unreadCount})`} />
            <SegmentedControlItem value="offers" label={`Offres (${offersCount})`} />
            <SegmentedControlItem value="emails" label={`Envoyés (${emailsCount})`} />
          </SegmentedControl>

          {unreadCount > 0 && (
            <Button
              label="Tout marquer comme lu"
              variant="ghost"
              size="sm"
              icon={<CheckCheck className="w-3.5 h-3.5" />}
              onClick={onMarkAllAsRead}
            />
          )}
        </div>

        {/* Notifications List */}
        <p className="px-5 pt-2 text-[11px] text-slate-400 shrink-0">
          Ouvrir une notification la marque comme lue.
        </p>
        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {filteredNotifications.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={<Check className="w-6 h-6 text-emerald-500" />}
                title="Tout est à jour !"
                description={
                  filter === 'unread'
                    ? 'Aucune nouvelle alerte.'
                    : filter === 'offers'
                      ? 'Aucune offre reçue pour le moment.'
                      : filter === 'emails'
                        ? 'Aucun courriel envoyé pour le moment.'
                        : 'Les actions de Jimy et les réponses des sociétés apparaîtront ici.'
                }
              />
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
                  {isUnread && (
                    <span
                      className="absolute top-4 right-3 w-2 h-2 rounded-full bg-[#1A73E8]"
                      title="Nouvelle alerte"
                    />
                  )}

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

                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className={
                          isUnread
                            ? 'font-heading font-bold text-xs text-[#0B2240]'
                            : 'font-heading font-medium text-xs text-slate-500'
                        }
                      >
                        {item.title}
                      </span>
                      {!isUnread && <Badge label="Lu" variant="gray" />}
                      {item.canton && (
                        <Badge label={item.canton} variant="gray" />
                      )}
                      {item.price && (
                        <Badge label={item.price} variant="orange" />
                      )}
                    </div>

                    <p
                      className={`text-xs line-clamp-2 mt-0.5 leading-relaxed ${
                        isUnread ? 'text-slate-600' : 'text-slate-400'
                      }`}
                    >
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

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <IconButton
                      label={item.isRead ? 'Marquer comme non lu' : 'Marquer comme lu'}
                      variant="ghost"
                      size="sm"
                      icon={
                        item.isRead ? (
                          <EyeOff className="w-3.5 h-3.5" />
                        ) : (
                          <Eye className="w-3.5 h-3.5 text-[#1A73E8]" />
                        )
                      }
                      onClick={() => {
                        if (item.isRead) {
                          onMarkAsUnread(item.id);
                        } else {
                          onMarkAsRead(item.id);
                        }
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer: Reset Badge Counters */}
        <div className="p-3 bg-slate-50 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 shrink-0">
          <Button
            label="Réinitialiser les alertes"
            variant="ghost"
            size="sm"
            icon={<CheckCheck className="w-3.5 h-3.5 text-[#FF6B00]" />}
            onClick={onClearSeenCounters}
          />

          <span className="text-[11px] text-slate-400">Activité de JimyScout</span>
        </div>
      </div>
    </Drawer>
  );
};
