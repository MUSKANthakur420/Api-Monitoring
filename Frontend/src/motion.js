import { motion } from "framer-motion";

// Animation variants
export const variants = {
  fadeIn: {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.3, ease: "easeOut" }
  },

  fadeInStagger: {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.25, ease: "easeOut" }
  },

  scalePulse: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.05, 1] },
    transition: { duration: 1.5, repeat: Infinity, ease: "easeInOut" }
  },

  hoverScale: {
    initial: { scale: 1 },
    hover: { scale: 1.02 },
    press: { scale: 0.98 }
  },

  statusUpdate: {
    initial: { scale: 1 },
    animate: { scale: [1, 1.1, 1, 0.95, 1] },
    transition: { duration: 0.6, type: "spring", stiffness: 300 }
  },

  slideUp: {
    initial: { opacity: 0, y: 30 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
    transition: { duration: 0.4, ease: "easeOut" }
  },

  metricsCount: {
    initial: { value: 0 },
    animate: { value: 100 },
    transition: { duration: 2, ease: "easeOut" }
  }
};

// Motion components with default variants
export const MotionDiv = motion.div;
export const MotionButton = motion.button;
export const MotionH3 = motion.h3;
export const MotionSpan = motion.span;
export const MotionForm = motion.form;
export const MotionModal = motion.div;
export const MotionUl = motion.ul;
export const MotionLi = motion.li;