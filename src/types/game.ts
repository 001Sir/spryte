export interface Game {
  slug: string;
  title: string;
  description: string;
  categories: Category[];
  controls: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  thumbnail: string;
  color: string;
  featured?: boolean;
  isNew?: boolean;
}

export type Category =
  | 'Action'
  | 'Arcade'
  | 'Puzzle'
  | 'Racing'
  | 'Strategy';
