// Allowed email providers (standard, reputable providers)
const ALLOWED_DOMAINS = [
  // Google
  'gmail.com',
  'googlemail.com',
  // Microsoft
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  // Yahoo
  'yahoo.com',
  'yahoo.co.uk',
  'yahoo.ca',
  'yahoo.com.au',
  'ymail.com',
  // Apple
  'icloud.com',
  'me.com',
  'mac.com',
  // Other major providers
  'aol.com',
  'protonmail.com',
  'proton.me',
  'zoho.com',
  'mail.com',
  'gmx.com',
  'gmx.net',
  // ISP providers
  'comcast.net',
  'verizon.net',
  'att.net',
  'cox.net',
  'charter.net',
  'frontier.com',
  // Regional/International
  'qq.com',
  '163.com',
  '126.com',
  'sina.com',
  'rediffmail.com',
  'yandex.com',
  'yandex.ru',
  'mail.ru',
  // Educational (common patterns)
  'edu',
];

// Known disposable/temporary email domains (comprehensive list)
const DISPOSABLE_DOMAINS = [
  // Most common temp email services
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamail.org',
  'guerrillamail.net',
  'sharklasers.com',
  'grr.la',
  'guerrillamailblock.com',
  'pokemail.net',
  'spam4.me',
  '10minutemail.com',
  '10minutemail.net',
  '10minutemail.org',
  'minutemail.com',
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'mailinater.com',
  'throwaway.email',
  'throwawaymail.com',
  'fakeinbox.com',
  'fakemailgenerator.com',
  'getnada.com',
  'nada.email',
  'tempail.com',
  'dispostable.com',
  'yopmail.com',
  'yopmail.fr',
  'yopmail.net',
  'cool.fr.nf',
  'jetable.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'courriel.fr.nf',
  'moncourrier.fr.nf',
  'monemail.fr.nf',
  'monmail.fr.nf',
  'hide.biz.st',
  'mytrashmail.com',
  'mt2009.com',
  'trashmail.com',
  'trashmail.net',
  'trashmail.org',
  'trashmail.me',
  'trashemail.de',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
  'spamgourmet.com',
  'spamgourmet.net',
  'spamgourmet.org',
  'getairmail.com',
  'mailnesia.com',
  'mailnull.com',
  'mailcatch.com',
  'mailscrap.com',
  'meltmail.com',
  'mintemail.com',
  'spamex.com',
  'spamfree24.org',
  'spamhole.com',
  'spamify.com',
  'spamspot.com',
  'emailondeck.com',
  'burnermail.io',
  'mailsac.com',
  'mohmal.com',
  'temp.email',
  'tempinbox.com',
  'tempr.email',
  'tempmailaddress.com',
  'tmpmail.org',
  'tmpmail.net',
  'discard.email',
  'discardmail.com',
  'disposableemailaddresses.com',
  'emailtemporar.ro',
  'emailtemporario.com.br',
  'crazymailing.com',
  'maildrop.cc',
  'inboxbear.com',
  'mailnator.com',
  'receiveee.com',
  'trbvm.com',
  'trbvn.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'teleworm.us',
  'mailforspam.com',
  'spamherelots.com',
  'willselfdestruct.com',
  'deadaddress.com',
  'sogetthis.com',
  'spamobox.com',
  'mailslite.com',
  'spambog.com',
  'spambog.de',
  'spambog.ru',
  'mailmetrash.com',
  'thankyou2010.com',
  'trash2009.com',
  'binkmail.com',
  'bobmail.info',
  'chammy.info',
  'devnullmail.com',
  'dfgh.net',
  'dingbone.com',
  'dodgit.com',
  'dodgeit.com',
  'dontgotmail.com',
  'e4ward.com',
  'emailias.com',
  'emailto.de',
  'emailwarden.com',
  'enterto.com',
  'ephemail.net',
  'etranquil.com',
  'etranquil.net',
  'etranquil.org',
  'dontreg.com',
  'dontsendmespam.de',
  'dump-email.info',
  'dumpmail.de',
  'dumpyemail.com',
  'spamfree.eu',
  'filzmail.com',
  'fizmail.com',
  'frapmail.com',
  'gishpuppy.com',
  'great-host.in',
  'greensloth.com',
  'haltospam.com',
  'hatespam.org',
  'herp.in',
  'hidemail.de',
  'hidzz.com',
  'hulapla.de',
  'ieatspam.eu',
  'ieatspam.info',
  'ihateyoualot.info',
  'imails.info',
  'inbound.plus',
  'incognitomail.com',
  'incognitomail.net',
  'incognitomail.org',
  'insorg-mail.info',
  'ipoo.org',
  'irish2me.com',
  'jetable.com',
  'jetable.net',
  'jetable.org',
  'jnxjn.com',
  'kasmail.com',
  'klassmaster.com',
  'klassmaster.net',
  'klzlv.com',
  'kulturbetrieb.info',
  'kurzepost.de',
  'lawlita.com',
  'letthemeatspam.com',
  'lhsdv.com',
  'lifebyfood.com',
  'link2mail.net',
  'litedrop.com',
  'lol.ovpn.to',
  'lolfreak.net',
  'lookugly.com',
  'lopl.co.cc',
  'lortemail.dk',
  'lovemeleaveme.com',
  'lr78.com',
  'maboard.com',
  'mail-hierarchyprovide.in',
  'mail.by',
  'mail.mezimages.net',
  'mail.zp.ua',
  'mail2rss.org',
  'mailbidon.com',
  'mailblocks.com',
  'mailcatch.com',
  'maileater.com',
  'mailexpire.com',
  'mailfa.tk',
  'mailfork.com',
  'mailfreeonline.com',
  'mailguard.me',
  'mailin8r.com',
  'mailinater.com',
  'mailincubator.com',
  'mailismagic.com',
  'mailmate.com',
  'mailmoat.com',
  'mailnull.com',
  'mailshell.com',
  'mailsiphon.com',
  'mailslapping.com',
  'mailtemp.info',
  'mailtothis.com',
  'mailzilla.com',
  'mailzilla.org',
  'makemetheking.com',
  'manifestgenerator.com',
  'manybrain.com',
  'mbx.cc',
  'mega.zik.dj',
  'meinspamschutz.de',
  'meltmail.com',
  'messagebeamer.de',
  'mezimages.net',
  'mierdamail.com',
  'migmail.pl',
  'migumail.com',
];

// Advanced regex for basic email format
const EMAIL_FORMAT_REGEX = /^[a-zA-Z0-9](?:[a-zA-Z0-9._%+-]{0,62}[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9.-]{0,61}[a-zA-Z0-9])?\.(?:[a-zA-Z]{2,})$/i;

// Pattern to detect random/gibberish usernames (common in disposable emails)
const GIBBERISH_PATTERNS = [
  /^[a-z]{20,}$/i, // Very long random letters
  /^[a-z0-9]{15,}$/i, // Long alphanumeric strings
  /^[a-z]+\d{6,}$/i, // Letters followed by many numbers
  /^\d+[a-z]+$/i, // Numbers followed by letters
  /^temp/i, // Starts with temp
  /^test/i, // Starts with test
  /^fake/i, // Starts with fake
  /^spam/i, // Starts with spam
  /^throw/i, // Starts with throw
  /^trash/i, // Starts with trash
  /^disposable/i, // Starts with disposable
  /^noreply/i, // noreply addresses
  /^no-reply/i, // no-reply addresses
];

export interface EmailValidationResult {
  isValid: boolean;
  email?: string;
  error?: string;
}

/**
 * Validates an email address with strict rules:
 * 1. Must match valid email format
 * 2. Must be from an allowed provider (or .edu domain)
 * 3. Must not be from a disposable email service
 * 4. Must not have a suspicious/gibberish username
 */
export function validateEmail(email: string): EmailValidationResult {
  const trimmedEmail = email.trim().toLowerCase();
  
  // Basic format validation
  if (!EMAIL_FORMAT_REGEX.test(trimmedEmail)) {
    return { isValid: false, error: "Please enter a valid email address" };
  }
  
  const [username, domain] = trimmedEmail.split('@');
  
  if (!username || !domain) {
    return { isValid: false, error: "Please enter a valid email address" };
  }
  
  // Check for disposable email domains
  if (DISPOSABLE_DOMAINS.some(d => domain === d || domain.endsWith('.' + d))) {
    return { isValid: false, error: "Please use a permanent email address (no temporary emails)" };
  }
  
  // Check for gibberish/suspicious usernames
  if (GIBBERISH_PATTERNS.some(pattern => pattern.test(username))) {
    return { isValid: false, error: "Please use your real email address" };
  }
  
  // Check if domain is in allowed list or is an .edu domain
  const isAllowedDomain = ALLOWED_DOMAINS.some(allowed => {
    if (allowed === 'edu') {
      return domain.endsWith('.edu');
    }
    return domain === allowed;
  });
  
  if (!isAllowedDomain) {
    return { isValid: false, error: "Please use a standard email provider (Gmail, Outlook, Yahoo, etc.)" };
  }
  
  return { isValid: true, email: trimmedEmail };
}

/**
 * Extracts and validates an email from text content
 * Returns the validated email if found, or null
 */
export function extractValidEmail(text: string): string | null {
  // Simple extraction regex
  const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/i);
  
  if (!emailMatch) {
    return null;
  }
  
  const result = validateEmail(emailMatch[0]);
  return result.isValid ? result.email! : null;
}

/**
 * Check if text contains a valid email
 */
export function containsValidEmail(text: string): boolean {
  return extractValidEmail(text) !== null;
}
