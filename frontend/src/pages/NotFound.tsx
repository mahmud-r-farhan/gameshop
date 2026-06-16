import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import {
  Gamepad2,
  Home,
  ShoppingBag,
  Ghost,
} from 'lucide-react';

const floatingAnimation = {
  animate: {
    y: [-10, 10, -10],
    rotate: [-5, 5, -5],
    transition: {
      duration: 4,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

export const NotFound = () => {
  return (
    <div className="relative min-h-screen overflow-hidden flex items-center justify-center bg-background px-4">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-background to-cyan-500/10" />

        {/* Floating Orbs */}
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute h-3 w-3 rounded-full bg-primary/20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [-20, 20, -20],
              opacity: [0.3, 1, 0.3],
            }}
            transition={{
              duration: 3 + i,
              repeat: Infinity,
            }}
          />
        ))}
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-10 max-w-xl text-center"
      >
        {/* Floating Icon */}
        <motion.div
          variants={floatingAnimation}
          animate="animate"
          className="mb-8"
        >
          <div className="relative inline-flex">
            <Gamepad2 className="h-28 w-28 text-primary drop-shadow-[0_0_30px_rgba(168,85,247,0.7)]" />

            <motion.div
              animate={{
                scale: [1, 1.2, 1],
                opacity: [0.4, 0.8, 0.4],
              }}
              transition={{
                duration: 2,
                repeat: Infinity,
              }}
              className="absolute inset-0 rounded-full bg-primary/20 blur-3xl"
            />
          </div>
        </motion.div>

        {/* Glitch 404 */}
        <motion.h1
          className="text-7xl md:text-9xl font-black tracking-tight mb-4"
          animate={{
            textShadow: [
              '2px 0 #00ffff',
              '-2px 0 #ff00ff',
              '2px 0 #00ffff',
            ],
          }}
          transition={{
            duration: 0.2,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        >
          404
        </motion.h1>

        <div className="flex justify-center mb-4">
          <Ghost className="h-8 w-8 text-muted-foreground" />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold mb-3">
          Quest Not Found
        </h2>

        <p className="text-muted-foreground text-lg mb-8">
          The level you're trying to access doesn't exist or has been moved.
          Let's get you back into the game.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Link to="/">
            <Button size="lg" className="gap-2 min-w-[180px]">
              <Home size={18} />
              Back Home
            </Button>
          </Link>

          <Link to="/shop">
            <Button
              variant="outline"
              size="lg"
              className="gap-2 min-w-[180px]"
            >
              <ShoppingBag size={18} />
              Browse Games
            </Button>
          </Link>
        </div>

        {/* XP Message */}
        <motion.p
          className="mt-8 text-sm text-muted-foreground"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 2,
            repeat: Infinity,
          }}
        >
          +0 XP • Page Missing
        </motion.p>
      </motion.div>
    </div>
  );
};