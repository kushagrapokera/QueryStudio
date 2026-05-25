# design.md — Premium AI Web App Interface

## Overview

Design a modern AI conversational web application with a calm, premium, editorial aesthetic inspired by interfaces like Claude, Notion AI, and modern productivity SaaS platforms.

The interface should feel:

* minimal
* intelligent
* spacious
* elegant
* human-centered
* distraction-free

The design must be fully responsive and optimized for desktop-first web experiences.

---

# Design Style

## Keywords

* Premium SaaS
* Editorial minimalism
* Conversational workspace
* Soft neutral aesthetics
* Intelligent interface
* Ambient UI
* Calm productivity

---

# Layout Structure

## Main Layout

```txt id="jyt1gs"
App Layout
├── Sidebar Navigation
├── Top Navigation Bar
├── Main Hero Workspace
│   ├── Ambient Glow Layer
│   ├── Greeting Section
│   ├── Chat Input Container
│   └── Quick Action Pills
```

---

# Color Hierarchy

The interface follows a warm neutral editorial palette with soft beige layering and subtle contrast.

---

## Majority Colors — Primary Foundation

These dominate most of the interface:

* page background
* striped sections
* workspace area
* large surfaces

### Majority Palette

```txt id="p1sqw7"
#F6F2EC
#F1ECE5
#ECE7DF
```

### Usage

* Main background
* Vertical stripe layers
* Sidebar background
* Workspace surfaces

### Feel

* Calm
* Spacious
* Editorial
* Minimal

---

## Mid-Priority Colors — Secondary UI Elements

Used for:

* cards
* chatbox
* quick action pills
* search bars
* interactive surfaces

### Mid Palette

```txt id="mt6k5v"
#F3F0EC
#E8E3DC
#DED8D0
```

### Usage

* Chat input container
* Buttons
* Action pills
* Hover states
* Surface separation

### Feel

* Soft depth
* Premium neutrality
* Layered interface

---

## Minority Colors — Accent & Contrast

Used sparingly for:

* typography
* icons
* borders
* separators

### Minority Palette

```txt id="9crxka"
#222222
#6F6B65
#DDD6CE
```

### Usage

* Primary text
* Secondary text
* Borders
* Icons
* UI structure

### Feel

* Elegant readability
* Clean contrast
* Subtle emphasis

---

## Ambient Glow Colors

The ambient spotlight glow behind the hero section uses warm translucent beige tones.

### Glow Palette

```txt id="y2zv9d"
rgba(236, 224, 214, 0.45)
rgba(236, 224, 214, 0.12)

#ECE0D6
#EADFD4
```

### Usage

* Hero spotlight
* Ambient lighting
* Depth enhancement
* Conversational focus

---

# Background Design

## Main Background

Use subtle vertical striped sections across the workspace.

### Background Style

```css id="m48b1i"
background: repeating-linear-gradient(
  to right,
  #F6F2EC 0px,
  #F6F2EC 180px,
  #F1ECE5 180px,
  #F1ECE5 360px
);
```

The stripes should:

* be extremely subtle
* create depth without distraction
* maintain a clean editorial aesthetic

---

# Ambient Glow Layer

Add a soft ambient radial glow behind the hero section and chat input container.

This glow acts as:

* visual focus mechanism
* depth enhancer
* atmospheric lighting layer

The glow should:

* sit behind the heading and chatbox
* blend softly into the striped background
* feel warm and premium
* never overpower the interface

---

## Glow Styling

### Suggested CSS

```css id="uuv7a5"
.hero-glow {
    position: absolute;
    width: 700px;
    height: 700px;

    background: radial-gradient(
        circle,
        rgba(236, 224, 214, 0.45) 0%,
        rgba(236, 224, 214, 0.12) 40%,
        transparent 75%
    );

    filter: blur(40px);
    pointer-events: none;
    z-index: 0;
}
```

---

# Typography

## Heading Font

Use elegant serif typography:

* Playfair Display
* Cormorant Garamond
* Libre Baskerville

---

## Hero Heading

Text Example:

```txt id="adeife"
Hey Federico
What can I help you with today?
```

### Styling

```css id="z6nfns"
font-size: 64px;
font-weight: 500;
line-height: 1.1;
text-align: center;
```

### Italic Accent

The username should:

* appear italicized
* slightly lighter
* elegant and soft

---

# Sidebar Navigation

## Width

```css id="9lbl0x"
width: 300px;
```

## Sidebar Style

```css id="sge2jk"
background: #ECE7DF;
border-right: 1px solid #DDD5CB;
```

The sidebar should include:

* search bar
* chat history
* smooth hover states
* soft neutral surfaces

---

# Search Bar

## Style

```css id="dd7e2v"
height: 46px;
border-radius: 14px;
background: #F7F3EE;
```

Placeholder:

```txt id="ejcgqd"
Search chats...
```

---

# Hero Workspace

## Layout

Center all content vertically and horizontally.

### Suggested CSS

```css id="jmumsb"
display: flex;
flex-direction: column;
align-items: center;
justify-content: center;
min-height: 100vh;
position: relative;
```

---

# Chat Input Container

The chat input should feel:

* soft
* premium
* floating
* modern

---

## Container Styling

### Dimensions

```css id="hptea4"
width: 680px;
min-height: 140px;
```

### Appearance

```css id="7lm7rx"
background: #F3F0EC;
border: 1px solid #DDD6CE;
border-radius: 24px;
box-shadow: 0 8px 24px rgba(0,0,0,0.04);
position: relative;
z-index: 2;
```

---

# Input Field

Placeholder:

```txt id="ar18f1"
Ask anything
```

### Styling

```css id="w1uyig"
font-size: 18px;
background: transparent;
border: none;
outline: none;
width: 100%;
```

---

# Toolbar Section

Inside the chat container include:

* Add button
* Online toggle
* Research button
* Tools button
* Voice button
* Send button

---

# Toolbar Buttons

### Style

```css id="22zeyu"
padding: 10px 14px;
border-radius: 999px;
background: #E8E3DC;
transition: all 0.2s ease;
```

### Hover

```css id="ar4zlt"
transform: translateY(-1px);
background: #DED8D0;
```

---

# Quick Action Pills

Buttons:

* Learn
* Build
* Get advice
* Generate image
* Research

### Style

```css id="tt75y5"
height: 40px;
padding: 0 18px;
border-radius: 999px;
background: #ECE7E0;
```

---

# Interaction Design

## Motion Principles

* subtle
* calm
* responsive
* non-distracting

### Transitions

```css id="gi4lew"
transition: all 0.2s ease;
```

Avoid:

* flashy animations
* aggressive scaling
* neon effects
* glassmorphism overload

---

# Responsive Behavior

## Tablet

* collapse sidebar
* reduce hero heading size
* widen input container proportionally

---

## Mobile

* sidebar becomes drawer
* stacked action pills
* reduced spacing
* full-width chat container

---

# Tech Stack Recommendation

## Frontend

* React
* Next.js
* TailwindCSS

## UI Libraries

* shadcn/ui
* Radix UI

---

# Experience Goal

The final experience should feel:

* calm
* premium
* conversational
* elegant
* modern
* intelligent

The UI should guide attention naturally toward the conversational interface using spacing, typography, ambient lighting, and layered neutral tones rather than aggressive visual effects.
