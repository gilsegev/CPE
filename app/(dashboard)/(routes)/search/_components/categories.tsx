"use client";

import {
  Music,
  Camera,
  Dumbbell,
  LineChart,
  Laptop,
  Film,
  Settings,
  LucideIcon
} from "lucide-react";

import { CategoryItem } from "./category-item";

interface Category {
  id: string;
  name: string;
}

interface CategoriesProps {
  items: Category[];
}

const iconMap: Record<Category["name"], LucideIcon> = {
  "Music": Music,
  "Photography": Camera,
  "Fitness": Dumbbell,
  "Accounting": LineChart,
  "Computer Science": Laptop,
  "Filming": Film,
  "Engineering": Settings,
};

export const Categories = ({
  items,
}: CategoriesProps) => {
  return (
    <div className="flex items-center gap-x-2 overflow-x-auto pb-2">
      {items.map((item) => (
        <CategoryItem
          key={item.id}
          label={item.name}
          icon={iconMap[item.name]}
          value={item.id}
        />
      ))}
    </div>
  )
}