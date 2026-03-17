"""Chat pane component for Streamlit chat application."""

import streamlit as st
from typing import Optional, List

from ..models.app_state import AppState
from ..models.conversation import Conversation
from ..services.openrouter import OpenRouterService
from openai.types.chat import ChatCompletionMessageParam


def render_chat_pane(state: AppState) -> None:
    """Render the main chat interface."""
    
    # Get active conversation
    conversation = state.get_active_conversation()
    
    if not conversation:
        st.info("Start a new conversation to begin chatting!")
        return
    
    # Display conversation title
    st.title(conversation.title)
    
    # Get the current conversation path
    active_leaf_id = state.get_active_leaf_id()
    if active_leaf_id:
        try:
            conversation_path = conversation.get_path_to(active_leaf_id)
        except KeyError:
            # If the leaf doesn't exist, use the root
            conversation_path = [conversation.nodes[conversation.root_id]] if conversation.root_id else []
    else:
        # If no active leaf, start with root
        conversation_path = [conversation.nodes[conversation.root_id]] if conversation.root_id else []
    
    # Display conversation history (excluding system message)
    for message in conversation_path:
        if message.role == "system":
            # Optionally show system message in a subtle way
            with st.expander("System Prompt", expanded=False):
                st.write(message.content)
            continue
        
        # Display user/assistant messages
        with st.chat_message(message.role):
            st.write(message.content)
    
    # Chat input
    user_input = st.chat_input("Type a message...", key="chat_input")
    
    if user_input:
        # Add user message
        if active_leaf_id:
            parent_id = active_leaf_id
        else:
            parent_id = conversation.root_id
        
        user_message = conversation.add_message("user", user_input, parent_id)
        state.set_active_leaf_id(user_message.id)
        
        # Stream assistant response
        try:
            # Get API messages for the current conversation
            api_messages = conversation.get_api_messages(user_message.id)
            
            # Convert to proper OpenAI message format
            messages: List[ChatCompletionMessageParam] = [
                {"role": msg["role"], "content": msg["content"]}  # type: ignore
                for msg in api_messages
            ]
            
            # Initialize OpenRouter service
            api_key = state.get_api_key()
            if not api_key:
                st.error("Please enter your OpenRouter API key in the sidebar")
                return
            
            service = OpenRouterService(api_key)
            model = state.get_selected_model()
            
            # Create a placeholder for the assistant's response
            assistant_placeholder = st.empty()
            assistant_message_content = ""
            
            # Stream the response
            with assistant_placeholder.chat_message("assistant"):
                message_placeholder = st.empty()
                
                for chunk in service.stream_chat_completion(model, messages):
                    assistant_message_content += chunk
                    message_placeholder.markdown(assistant_message_content + "▌")
                
                # Remove the cursor
                message_placeholder.markdown(assistant_message_content)
            
            # Save the complete assistant message
            assistant_message = conversation.add_message(
                "assistant", 
                assistant_message_content, 
                user_message.id
            )
            state.set_active_leaf_id(assistant_message.id)
            
        except Exception as e:
            st.error(f"Error getting response: {str(e)}")
            # Remove the user message if assistant failed
            if active_leaf_id and parent_id:
                parent = conversation.nodes[parent_id]
                if user_message.id in parent.children_ids:
                    parent.children_ids.remove(user_message.id)
            if user_message.id in conversation.nodes:
                del conversation.nodes[user_message.id]
            state.set_active_leaf_id(active_leaf_id)
