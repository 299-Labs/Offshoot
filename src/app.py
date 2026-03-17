# Streamlit entry point
import streamlit as st

from src.models.app_state import AppState
from src.components.sidebar import render_sidebar
from src.components.chat_pane import render_chat_pane


def main():
    """Main application entry point."""
    # Initialize app state with Streamlit session state
    state = AppState(st.session_state)
    
    # Set page configuration
    st.set_page_config(
        page_title="Offshoot",
        page_icon="🌿",
        layout="wide",
        initial_sidebar_state="expanded"
    )
    
    # Render sidebar
    with st.sidebar:
        render_sidebar(state)
    
    # Render main chat pane
    render_chat_pane(state)


if __name__ == "__main__":
    main()
