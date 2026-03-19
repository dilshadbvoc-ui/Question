'use client';

import { motion } from 'framer-motion';

interface LoadingAnimationProps {
  status: string;
}

export default function LoadingAnimation({ status }: LoadingAnimationProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-4 p-8">
      <div className="relative w-16 h-16">
        <motion.span
          className="absolute top-0 left-0 w-full h-full border-4 border-gray-200 rounded-full"
        />
        <motion.span
          className="absolute top-0 left-0 w-full h-full border-4 border-blue-500 rounded-full border-t-transparent"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        />
      </div>
      
      <motion.p
        key={status}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="text-lg font-medium text-gray-700"
      >
        {status}
      </motion.p>
    </div>
  );
}
