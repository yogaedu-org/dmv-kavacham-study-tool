# श्रीदशमहाविद्याकवचम् - Interactive Study Tool

**🌐 [Try the Interactive Tool](https://yogaedu-org.github.io/dmv-kavacham-study-tool/)** ← Click here to use the application

An advanced web application for studying the Daśamahāvidyā Kavacam (Armor of the Ten Great Wisdom Goddesses). This tool provides multi-modal exploration through Sanskrit text, transliteration, translation, and intelligent filtering.

## 🌟 Features

### Text Display Options
- **Sanskrit Text**: Original Devanāgarī script with proper formatting
- **Transliteration**: IAST romanization for pronunciation guidance
- **Translation**: Complete English prose translations
- **Independent Toggles**: Show/hide Sanskrit and transliteration independently

### Advanced Filtering & Search
- **Multi-Category Filtering**: Filter by deities, directions, and body parts
- **OR-Logic Filtering**: Verses match if they contain ANY selected filter
- **Real-time Search**: Search across all verse content with autocomplete
- **Visual Filter Tags**: Active filters displayed as removable tags
- **Smart Autocomplete**: Type-ahead suggestions with category indicators

### Interactive Elements
- **Sticky Navigation**: Responsive search box that stays accessible while scrolling
- **Custom Dropdowns**: Multi-select dropdowns for each filter category
- **Highlight System**: Visual highlighting of verses matching active filters
- **Responsive Design**: Optimized for desktop and mobile viewing

### Study Features
- **Complete Coverage**: All 14 verses with structured metadata
- **Anatomical Mapping**: Systematic body part protection coverage
- **Directional Protection**: Eight directions plus comprehensive coverage
- **Deity Epithets**: Multiple names and forms for each goddess

## 🎯 Technical Architecture

### Data Structure
Each verse contains:
- **number**: Verse sequence (1-14)
- **sanskrit**: Devanāgarī text with HTML formatting
- **transliteration**: IAST romanization
- **translation**: English prose translation
- **deities**: Array of goddess names/epithets
- **directions**: Array of spatial orientations
- **bodyParts**: Array of anatomical terms

### Core Components
- **Data Layer**: `VERSE_DATA` array with structured verse objects
- **State Management**: `AppState` object with centralized application state
- **UI Layer**: `UI` object handling DOM interactions and rendering
- **Pure Implementation**: No external dependencies (HTML/CSS/JS only)

### CSS Framework
- **Glassmorphism Design**: Modern backdrop-filter effects
- **Color-Coded Categories**: Red (deities), teal (directions), orange (body parts)
- **Responsive Layout**: Mobile-first approach with smooth transitions
- **Accessibility**: High contrast, semantic HTML, keyboard navigation

## 🚀 Usage

### Text Study
1. **Toggle Display**: Use checkboxes to show/hide Sanskrit or transliteration
2. **Verse Navigation**: Each verse numbered and clearly separated
3. **Category Tags**: Visual indicators for deities, directions, and body parts

### Filtering & Search
1. **Dropdown Filters**: Select multiple items from each category
2. **Search Box**: Type to find specific terms with autocomplete
3. **Filter Tags**: Active filters shown as removable tags
4. **Clear Filters**: One-click reset of all filters

### Spatial Analysis
- **Directional Coverage**: Filter by compass directions (East, West, etc.)
- **Anatomical Study**: Explore protection by body parts (head, chest, etc.)
- **Deity Research**: Study specific goddesses across verses

## 📖 Content Overview

### Verse Structure
- **Verses 1-4**: Directional protection (8 directions + above + all-around)
- **Verses 5-11**: Anatomical coverage (head to toe protection)
- **Verses 12-14**: Comprehensive protection and completion

### Goddess Names
Contains multiple epithets and regional variations for:
- Kālī/Kālikā, Tārā, Tripurasundarī/Ṣoḍaśī
- Bhuvaneśvarī, Chinnamastā, Bhairavī
- Dhūmāvatī, Bagalāmukhī, Mātaṅgī
- Various regional and textual name variations

### Anatomical Coverage
Complete protection mapping:
- **Head Region**: Head, forehead, brows, eyes, ears, nose
- **Face/Neck**: Face, mouth, tongue, neck
- **Torso**: Chest, back, abdomen, hips
- **Limbs**: Arms, fingers, legs, thighs, toes
- **Internal**: Blood, flesh, bones, marrow

## 🔗 Live Demo

**Primary Access**: https://yogaedu-org.github.io/dmv-kavacham-study-tool/

## 🛠️ Development

### File Structure
```
├── dmv-kavacham-interactive.html  # Complete single-file application
└── README.md                      # This documentation
```

### Extensibility
- **Add Verses**: Extend `VERSE_DATA` array with new verse objects
- **New Categories**: Add metadata arrays and update filtering logic
- **UI Customization**: Modify CSS variables and component styling
- **API Integration**: Build on state management layer for external data

### Performance Features
- **Efficient DOM Manipulation**: Cached element references
- **Minimal Re-rendering**: Targeted updates only
- **Event Delegation**: Optimized event handling
- **Responsive Caching**: Smart UI state management

## 📚 Cultural Context

The Daśamahāvidyā Kavacam is a traditional Sanskrit protective hymn invoking the ten great wisdom goddesses (Mahāvidyās) for comprehensive spiritual protection. This tool aids in:

- **Academic Study**: Textual analysis and comparison
- **Devotional Practice**: Memorization and recitation support
- **Cultural Education**: Understanding goddess traditions
- **Linguistic Learning**: Sanskrit and transliteration study

## 🎨 Design Philosophy

### Educational Focus
- **Multi-modal Learning**: Visual, textual, and interactive elements
- **Progressive Disclosure**: Information available at multiple levels
- **Cultural Sensitivity**: Respectful presentation of sacred texts

### User Experience
- **Intuitive Navigation**: Clear information hierarchy
- **Responsive Interaction**: Immediate feedback for all actions
- **Accessibility**: Compatible with screen readers and keyboard navigation
- **Performance**: Fast loading and smooth interactions
