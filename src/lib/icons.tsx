import {
  Apple, Bath, Bed, Bell, Brain, Candy, Carrot, Coffee, Droplet, Droplets, Dumbbell, Egg, Fish,
  Flame, FlaskConical, Footprints, GlassWater, Hand, Heart, Leaf, Moon, Pill, Salad, Scissors,
  ShowerHead, Smile, Soup, Sparkles, SprayCan, Star, Stethoscope, Sun, SunMedium, Syringe, Tablets,
  Timer, Utensils, Wind, Wheat, Waves, Grid3x3, Milk, Citrus, Bike, type LucideIcon,
} from 'lucide-react';

export const ICONS: Record<string, LucideIcon> = {
  droplet: Droplet, droplets: Droplets, sparkles: Sparkles, sun: Sun, sunscreen: SunMedium, moon: Moon,
  spray: SprayCan, flask: FlaskConical, pill: Pill, tablets: Tablets, syringe: Syringe, hand: Hand,
  scissors: Scissors, shower: ShowerHead, bath: Bath, waves: Waves, wind: Wind, stamp: Grid3x3,
  bed: Bed, smile: Smile, heart: Heart, leaf: Leaf, apple: Apple, salad: Salad, carrot: Carrot,
  citrus: Citrus, egg: Egg, fish: Fish, wheat: Wheat, soup: Soup, utensils: Utensils, milk: Milk,
  water: GlassWater, coffee: Coffee, candy: Candy, flame: Flame, dumbbell: Dumbbell, bike: Bike,
  steps: Footprints, timer: Timer, brain: Brain, doctor: Stethoscope, star: Star, bell: Bell,
};

export const ICON_NAMES = Object.keys(ICONS);

export function Icon({ name, size = 18, ...rest }: { name: string; size?: number; strokeWidth?: number; className?: string }) {
  const C = ICONS[name] ?? Star;
  return <C size={size} strokeWidth={rest.strokeWidth ?? 2.2} className={rest.className} />;
}

export function IconTile({ name, color, size = 40, dim = false }: { name: string; color: string; size?: number; dim?: boolean }) {
  return (
    <span
      className="tile"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `linear-gradient(160deg, ${color}, color-mix(in srgb, ${color} 72%, #000))`,
        opacity: dim ? 0.45 : 1,
      }}
    >
      <Icon name={name} size={size * 0.5} />
    </span>
  );
}
