export type Site = {
  NAME: string;
  /** Short monospace mark used in the top bar. */
  WORDMARK: string;
  /** Repository this site is built from. */
  SOURCE: string;
  EMAIL: string;
};

export type Metadata = {
  TITLE: string;
  DESCRIPTION: string;
};

export type Socials = {
  NAME: string;
  HREF: string;
}[];
