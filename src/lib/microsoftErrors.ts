function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return '';
}

export function getMicrosoftErrorMessage(error: unknown, fallback: string): string {
  const rawMessage = extractErrorMessage(error).trim();
  const message = rawMessage.toLowerCase();

  if (!rawMessage) return fallback;

  if (message.includes('aadsts50020') || message.includes('user account') && message.includes('identity provider')) {
    return 'This Microsoft account is not in the UAI tenant. Use a UAI work email.';
  }

  if (message.includes('access_denied')) {
    return 'Microsoft blocked this account from using PunchList. Contact UAI IT.';
  }

  if (message.includes('consent') || message.includes('interaction_required')) {
    return 'Microsoft sign-in needs tenant approval for this account. Contact UAI IT.';
  }

  if (
    message.includes("unable to retrieve user's mysite url") ||
    message.includes('resource not found for the segment') ||
    message.includes('/me/drive') ||
    message.includes('mysite')
  ) {
    return 'This user does not have OneDrive ready yet. Ask them to open OneDrive once or contact UAI IT.';
  }

  return `${fallback} ${rawMessage}`;
}
