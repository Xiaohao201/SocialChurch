import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatTimeAgo(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffWeeks = Math.floor(diffDays / 7);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffYears > 0) {
        return `${diffYears} year${diffYears === 1 ? '' : 's'} ago`;
    }
    if (diffMonths > 0) {
        return `${diffMonths} month${diffMonths === 1 ? '' : 's'} ago`;
    }
    if (diffWeeks > 0) {
        return `${diffWeeks} week${diffWeeks === 1 ? '' : 's'} ago`;
    }
    if (diffDays > 0) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
    if (diffHours > 0) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    }
    if (diffMinutes > 0) {
        return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    }
    return 'just now';
}

/**
 * 提取事工名称，处理 ministry 字段可能是字符串或对象的情况
 * @param ministry - 事工字段，可能是字符串、对象或 undefined
 * @returns 事工名称字符串
 */
export function getMinistryName(ministry: string | any | undefined): string {
    if (!ministry) return '未分配事工';
    if (typeof ministry === 'string') return ministry;
    if (typeof ministry === 'object' && ministry.name) return ministry.name;
    return '未知事工';
}