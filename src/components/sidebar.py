"""Sidebar component for Streamlit chat application."""

import streamlit as st
from typing import Optional

from ..models.app_state import AppState


def render_sidebar(state: AppState) -> None:
    """Render the sidebar with API key input, model selection, and conversation management."""
    
    st.title("Offshoot 🌿")
    
    # API Key input
    api_key = st.text_input(
        "OpenRouter API Key",
        value=state.get_api_key(),
        type="password",
        help="Enter your OpenRouter API key to enable chat functionality"
    )
    
    if api_key != state.get_api_key():
        state.set_api_key(api_key)
        st.rerun()
    
    # Model selection (only if API key is provided)
    if api_key:
        # TODO: Fetch models from OpenRouter service
        # For now, use a default list
        available_models = [
            "gpt-3.5-turbo",
            "gpt-4",
            "claude-3-sonnet",
            "gemini-pro"
        ]
        
        current_model = state.get_selected_model()
        selected_model = st.selectbox(
            "Select Model",
            options=available_models,
            index=available_models.index(current_model) if current_model in available_models else 0,
            help="Choose the AI model for chat completions"
        )
        
        if selected_model != current_model:
            state.set_selected_model(selected_model)
            st.rerun()
    else:
        st.info("Please enter your API key to select a model")
    
    st.divider()
    
    # New Chat button
    if st.button("➕ New Chat", type="primary"):
        conversation = state.create_new_conversation()
        st.rerun()
    
    st.divider()
    
    # Conversation list
    conversations = state.get_conversations()
    
    if not conversations:
        st.info("No conversations yet. Start a new chat!")
        return
    
    st.subheader("Conversations")
    
    # Display conversations
    for conv_id, conversation in conversations.items():
        active_conv = state.get_active_conversation()
        is_active = active_conv is not None and active_conv.id == conv_id
        
        # Create a button for each conversation
        button_label = f"💬 {conversation.title}"
        if st.button(
            button_label,
            key=f"conv_{conv_id}",
            use_container_width=True,
            type="primary" if is_active else "secondary"
        ):
            state.set_active_conversation(conv_id)
            st.rerun()
        
        # Show last message preview
        if conversation.nodes:
            # Get the latest message (leaf)
            leaf_ids = conversation.get_leaf_ids()
            if leaf_ids:
                latest_message = conversation.nodes[leaf_ids[0]]
                preview = latest_message.content[:50] + "..." if len(latest_message.content) > 50 else latest_message.content
                st.caption(f"Last: {preview}")
        
        st.divider()