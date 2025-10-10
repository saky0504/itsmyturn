# Project Guidelines

## 🎵 ItsMyTurn Music App

### Development Guidelines

#### Code Style
- **TypeScript**: Use TypeScript for all new files
- **Components**: Use functional components with hooks
- **Styling**: Use Tailwind CSS for styling
- **File Naming**: Use PascalCase for components, camelCase for utilities

#### Component Structure
```tsx
import React from 'react'

interface ComponentProps {
  // Define props with TypeScript
}

const Component: React.FC<ComponentProps> = ({ prop1, prop2 }) => {
  // Component logic
  
  return (
    <div className="tailwind-classes">
      {/* JSX content */}
    </div>
  )
}

export default Component
```

#### State Management
- Use React hooks (useState, useEffect, useContext)
- Keep state close to where it's used
- Consider Context API for global state

#### API Integration
- Spotify Web API for music data
- Supabase for backend services
- Use proper error handling and loading states

### Design Guidelines

#### Color Scheme
- **Primary**: Green (#1DB954) - Spotify brand color
- **Background**: Dark gray/black gradient
- **Text**: White and light gray
- **Accents**: Red for play states, gray for inactive

#### Typography
- **Headers**: Bold, large text
- **Body**: Regular weight, readable size
- **Captions**: Smaller, muted colors

#### Components
- **Vinyl Player**: Central music player with spinning vinyl animation
- **Track Cards**: Clean, minimal design with album art
- **Navigation**: Bottom navigation for mobile-first design

### File Organization

#### Folder Structure
```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   ├── figma/        # Figma-generated components
│   └── Layout.jsx    # Main layout component
├── pages/            # Page components
├── lib/              # Utility libraries
└── hooks/            # Custom React hooks
```

#### Import Order
1. React and React-related imports
2. Third-party libraries
3. Local components
4. Utilities and hooks
5. Styles

### Performance Guidelines

#### Optimization
- Use React.memo for expensive components
- Implement proper loading states
- Optimize images and assets
- Use lazy loading where appropriate

#### Bundle Size
- Import only needed functions from libraries
- Use dynamic imports for large components
- Monitor bundle size with build tools

### Testing Guidelines

#### Component Testing
- Test component rendering
- Test user interactions
- Test prop variations
- Test error states

#### Integration Testing
- Test API integrations
- Test routing
- Test state management

### Deployment Guidelines

#### Environment Variables
- Use `.env` files for configuration
- Never commit sensitive data
- Use different configs for dev/prod

#### Build Process
- Use Vite for building
- Optimize assets
- Test build locally before deployment

### Git Guidelines

#### Commit Messages
- Use conventional commit format
- Be descriptive and clear
- Reference issues when applicable

#### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch
- `feature/*`: New features
- `fix/*`: Bug fixes

### Documentation

#### Code Comments
- Comment complex logic
- Use JSDoc for functions
- Keep comments up to date

#### README Updates
- Update installation instructions
- Document new features
- Include usage examples

### Accessibility

#### Guidelines
- Use semantic HTML
- Provide alt text for images
- Ensure keyboard navigation
- Test with screen readers
- Maintain color contrast ratios

### Security

#### Best Practices
- Validate user input
- Sanitize data
- Use HTTPS in production
- Implement proper authentication
- Handle errors gracefully

---

*Last updated: [Current Date]*
*Version: 1.0.0*
