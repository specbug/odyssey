#!/usr/bin/env python3
"""
Comprehensive Spaced Repetition Algorithm Test & Simulation Script

This script tests the spaced repetition system by:
1. Creating cards and testing immediate availability
2. Simulating different review choices (Wrong vs Remembered)
3. Time-traveling to test card resurfacing
4. Tracking progression through learning states
5. Visualizing the binary tree expansion
6. Plotting progression charts
"""

import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set matplotlib to use non-interactive backend
import matplotlib

matplotlib.use("Agg")  # Use Agg backend for non-interactive plotting

from datetime import datetime, timedelta
import matplotlib.pyplot as plt
import matplotlib.patches as patches
from matplotlib.patches import FancyBboxPatch
import networkx as nx
from app.database import SessionLocal, engine
from app.models import Base, StudyCard, Annotation, PDFFile
from app.spaced_repetition import SpacedRepetitionService
import numpy as np
from collections import defaultdict, deque
import json


class SpacedRepetitionTester:
    def __init__(self):
        self.db = SessionLocal()
        self.cards_created = []
        self.review_history = []
        self.progression_tree = {}
        self.time_jumps = []

    def setup_test_data(self):
        """Create test PDF file and annotations for testing"""
        print("🔧 Setting up test data...")

        # Clean up existing test data first
        self.cleanup_test_data()

        # Create test PDF file
        test_pdf = PDFFile(
            filename="test_spaced_repetition.pdf",
            original_filename="test_spaced_repetition.pdf",
            file_hash=f"test_hash_{int(datetime.utcnow().timestamp())}",  # Unique hash
            file_size=1000,
            file_path="/test/path",
            mime_type="application/pdf",
        )
        self.db.add(test_pdf)
        self.db.commit()
        self.db.refresh(test_pdf)

        # Create test annotations
        annotations_data = [
            {"question": "What is 2+2?", "answer": "4"},
            {"question": "Capital of France?", "answer": "Paris"},
            {"question": "Python creator?", "answer": "Guido van Rossum"},
            {"question": "HTTP status 404 means?", "answer": "Not Found"},
            {"question": "Binary of 8?", "answer": "1000"},
        ]

        self.test_annotations = []
        for i, data in enumerate(annotations_data):
            annotation = Annotation(
                file_id=test_pdf.id,
                annotation_id=f"test_annotation_{i}_{int(datetime.utcnow().timestamp())}",
                page_index=0,
                question=data["question"],
                answer=data["answer"],
                highlighted_text="test text",
                position_data="{}",
            )
            self.db.add(annotation)
            self.db.commit()
            self.db.refresh(annotation)
            self.test_annotations.append(annotation)

        print(f"✅ Created {len(self.test_annotations)} test annotations")

    def cleanup_test_data(self):
        """Clean up any existing test data"""
        try:
            # Delete test study cards
            test_cards = (
                self.db.query(StudyCard)
                .join(Annotation)
                .filter(Annotation.annotation_id.like("test_annotation_%"))
                .all()
            )
            for card in test_cards:
                self.db.delete(card)

            # Delete test annotations
            test_annotations = (
                self.db.query(Annotation)
                .filter(Annotation.annotation_id.like("test_annotation_%"))
                .all()
            )
            for annotation in test_annotations:
                self.db.delete(annotation)

            # Delete test PDF files
            test_pdfs = (
                self.db.query(PDFFile)
                .filter(PDFFile.filename == "test_spaced_repetition.pdf")
                .all()
            )
            for pdf in test_pdfs:
                self.db.delete(pdf)

            self.db.commit()
            print("🧹 Cleaned up existing test data")
        except Exception as e:
            print(f"⚠️  Warning during cleanup: {e}")
            self.db.rollback()

    def create_test_card(self, annotation_id, card_name):
        """Create a study card and verify it appears immediately"""
        print(f"\n📋 Creating card: {card_name}")

        card = SpacedRepetitionService.create_study_card(self.db, annotation_id)
        self.cards_created.append({"card": card, "name": card_name})

        # Verify it appears in due cards immediately
        due_cards = SpacedRepetitionService.get_due_cards(self.db, 50)
        new_cards = due_cards["new_cards"]

        card_appears = any(c.id == card.id for c in new_cards)
        print(f"   ✅ Card appears immediately in new_cards: {card_appears}")
        print(
            f"   📊 Current state: is_new={card.is_new}, is_learning={card.is_learning}, is_graduated={card.is_graduated}"
        )

        return card

    def time_travel(self, minutes_forward):
        """Simulate time passing by updating all card review dates"""
        print(f"\n⏰ Time traveling {minutes_forward} minutes forward...")

        current_time = datetime.utcnow()
        new_time = current_time + timedelta(minutes=minutes_forward)

        # Update all cards that would be due by the new time
        cards = self.db.query(StudyCard).all()
        cards_updated = 0

        for card in cards:
            if card.next_review_date and card.next_review_date > current_time:
                # If card was scheduled for future, bring it to now if time has passed
                if card.next_review_date <= new_time:
                    card.next_review_date = new_time - timedelta(seconds=1)
                    cards_updated += 1

        self.db.commit()
        self.time_jumps.append(
            {
                "minutes": minutes_forward,
                "cards_affected": cards_updated,
                "timestamp": new_time,
            }
        )

        print(f"   🔄 Updated {cards_updated} cards to be due now")

    def review_card_and_track(self, card, quality, review_name):
        """Review a card and track the progression"""
        print(f"\n🎯 Reviewing card {card.id} with quality {quality} ({review_name})")

        # Store pre-review state
        pre_state = {
            "is_new": card.is_new,
            "is_learning": card.is_learning,
            "is_graduated": card.is_graduated,
            "learning_step": getattr(card, "learning_step", 0),
            "interval": card.interval,
            "next_review": card.next_review_date,
        }

        # Perform review
        result = SpacedRepetitionService.review_card(self.db, card.id, quality)
        self.db.refresh(card)

        # Store post-review state
        post_state = {
            "is_new": card.is_new,
            "is_learning": card.is_learning,
            "is_graduated": card.is_graduated,
            "learning_step": getattr(card, "learning_step", 0),
            "interval": card.interval,
            "next_review": card.next_review_date,
        }

        # Calculate time until next review
        if card.next_review_date:
            time_diff = (card.next_review_date - datetime.utcnow()).total_seconds()
            next_review_text = self.format_time_diff(time_diff)
        else:
            next_review_text = "No next review"

        review_record = {
            "card_id": card.id,
            "quality": quality,
            "review_name": review_name,
            "pre_state": pre_state,
            "post_state": post_state,
            "message": result.message,
            "next_review_text": next_review_text,
            "timestamp": datetime.utcnow(),
        }

        self.review_history.append(review_record)

        print(f"   📈 State transition:")
        print(
            f"      Before: new={pre_state['is_new']}, learning={pre_state['is_learning']}, graduated={pre_state['is_graduated']}"
        )
        print(
            f"      After:  new={post_state['is_new']}, learning={post_state['is_learning']}, graduated={post_state['is_graduated']}"
        )
        print(f"   ⏱️  Next review: {next_review_text}")
        print(f"   💬 Message: {result.message}")

        return review_record

    def format_time_diff(self, seconds):
        """Format time difference in human readable format"""
        if seconds < 60:
            return f"{int(seconds)} seconds"
        elif seconds < 3600:
            return f"{int(seconds / 60)} minutes"
        elif seconds < 86400:
            return f"{int(seconds / 3600)} hours"
        else:
            return f"{int(seconds / 86400)} days"

    def test_binary_progression(self, depth=4):
        """Test the binary tree progression of reviews"""
        print(f"\n🌳 Testing binary progression to depth {depth}")

        # Start with one card
        card = self.create_test_card(self.test_annotations[0].id, "Binary Tree Root")

        # Create progression tree
        tree = self.build_progression_tree(card, depth)

        return tree

    def build_progression_tree(
        self, root_card, max_depth, current_depth=0, path="root"
    ):
        """Recursively build progression tree by testing both choices"""
        if current_depth >= max_depth:
            return {
                "path": path,
                "depth": current_depth,
                "card_state": self.get_card_state(root_card),
            }

        tree = {
            "path": path,
            "depth": current_depth,
            "card_state": self.get_card_state(root_card),
            "branches": {},
        }

        # Test "Wrong" choice (quality 1)
        card_copy_wrong = self.simulate_review_path(root_card, 1, f"{path}_wrong")
        if card_copy_wrong:
            tree["branches"]["wrong"] = self.build_progression_tree(
                card_copy_wrong, max_depth, current_depth + 1, f"{path}_wrong"
            )

        # Test "Remembered" choice (quality 4)
        card_copy_right = self.simulate_review_path(root_card, 4, f"{path}_right")
        if card_copy_right:
            tree["branches"]["remembered"] = self.build_progression_tree(
                card_copy_right, max_depth, current_depth + 1, f"{path}_right"
            )

        return tree

    def simulate_review_path(self, original_card, quality, path_name):
        """Simulate a review without affecting the original card"""
        # For simulation, we'll create a new card with same state
        # and test the review logic

        # Create temporary annotation for simulation
        temp_annotation = Annotation(
            file_id=self.test_annotations[0].file_id,
            annotation_id=f"sim_{path_name}",
            page_index=0,
            question=f"Sim Question {path_name}",
            answer=f"Sim Answer {path_name}",
            highlighted_text="sim text",
            position_data="{}",
        )
        self.db.add(temp_annotation)
        self.db.commit()
        self.db.refresh(temp_annotation)

        # Create card with same state as original
        sim_card = StudyCard(
            annotation_id=temp_annotation.id,
            easiness=original_card.easiness,
            interval=original_card.interval,
            repetitions=original_card.repetitions,
            is_new=original_card.is_new,
            is_learning=original_card.is_learning,
            is_graduated=original_card.is_graduated,
            learning_step=getattr(original_card, "learning_step", 0),
            next_review_date=original_card.next_review_date,
        )
        self.db.add(sim_card)
        self.db.commit()
        self.db.refresh(sim_card)

        # Review the simulation card
        self.review_card_and_track(sim_card, quality, f"Simulation {path_name}")

        return sim_card

    def get_card_state(self, card):
        """Get current state of a card"""
        return {
            "is_new": card.is_new,
            "is_learning": card.is_learning,
            "is_graduated": card.is_graduated,
            "learning_step": getattr(card, "learning_step", 0),
            "interval": card.interval,
            "easiness": card.easiness,
            "repetitions": card.repetitions,
        }

    def visualize_progression_tree(self, tree, save_path="spaced_repetition_tree.png"):
        """Create a visual representation of the progression tree"""
        print(f"\n📊 Creating progression tree visualization...")

        fig, ax = plt.subplots(1, 1, figsize=(16, 12))

        # Create networkx graph
        G = nx.DiGraph()
        pos = {}
        node_colors = []
        node_labels = {}

        self._add_tree_nodes(G, tree, pos, node_colors, node_labels, x=0, y=0, level=0)

        # Draw the graph
        nx.draw(
            G,
            pos,
            ax=ax,
            node_color=node_colors,
            node_size=3000,
            font_size=8,
            font_weight="bold",
            with_labels=False,
            arrows=True,
            edge_color="gray",
            alpha=0.8,
        )

        # Add custom labels
        for node, (x, y) in pos.items():
            ax.text(
                x,
                y,
                node_labels[node],
                horizontalalignment="center",
                verticalalignment="center",
                fontsize=6,
                fontweight="bold",
            )

        ax.set_title(
            "Spaced Repetition Algorithm - Binary Progression Tree",
            fontsize=16,
            fontweight="bold",
            pad=20,
        )

        # Add legend
        legend_elements = [
            plt.Line2D(
                [0],
                [0],
                marker="o",
                color="w",
                markerfacecolor="lightblue",
                markersize=10,
                label="New Card",
            ),
            plt.Line2D(
                [0],
                [0],
                marker="o",
                color="w",
                markerfacecolor="orange",
                markersize=10,
                label="Learning Card",
            ),
            plt.Line2D(
                [0],
                [0],
                marker="o",
                color="w",
                markerfacecolor="lightgreen",
                markersize=10,
                label="Graduated Card",
            ),
        ]
        ax.legend(handles=legend_elements, loc="upper right")

        plt.tight_layout()
        plt.savefig(save_path, dpi=300, bbox_inches="tight")
        print(f"   💾 Saved tree visualization to {save_path}")

        return fig

    def _add_tree_nodes(self, G, tree, pos, colors, labels, x, y, level, parent=None):
        """Recursively add nodes to the graph"""
        node_id = tree["path"]
        G.add_node(node_id)

        # Position nodes
        pos[node_id] = (x, y)

        # Color based on card state
        state = tree["card_state"]
        if state["is_new"]:
            colors.append("lightblue")
        elif state["is_learning"]:
            colors.append("orange")
        elif state["is_graduated"]:
            colors.append("lightgreen")
        else:
            colors.append("gray")

        # Create label
        interval_text = (
            f"{state['interval']}d"
            if state["interval"] < 1440
            else f"{state['interval'] / 1440:.1f}d"
        )
        labels[node_id] = f"L{state['learning_step']}\n{interval_text}"

        # Add edge from parent
        if parent:
            G.add_edge(parent, node_id)

        # Add child nodes
        if "branches" in tree:
            child_spacing = 2 ** max(0, 3 - level)  # Adjust spacing based on level
            child_y = y - 1

            if "wrong" in tree["branches"]:
                child_x = x - child_spacing
                self._add_tree_nodes(
                    G,
                    tree["branches"]["wrong"],
                    pos,
                    colors,
                    labels,
                    child_x,
                    child_y,
                    level + 1,
                    node_id,
                )

            if "remembered" in tree["branches"]:
                child_x = x + child_spacing
                self._add_tree_nodes(
                    G,
                    tree["branches"]["remembered"],
                    pos,
                    colors,
                    labels,
                    child_x,
                    child_y,
                    level + 1,
                    node_id,
                )

    def create_progression_charts(self):
        """Create charts showing progression statistics"""
        print(f"\n📈 Creating progression charts...")

        fig, ((ax1, ax2), (ax3, ax4)) = plt.subplots(2, 2, figsize=(15, 12))

        # Chart 1: Review History Timeline
        review_times = [r["timestamp"] for r in self.review_history]
        review_qualities = [r["quality"] for r in self.review_history]

        colors = ["red" if q == 1 else "green" for q in review_qualities]
        ax1.scatter(
            range(len(review_times)), review_qualities, c=colors, s=100, alpha=0.7
        )
        ax1.set_title("Review Quality Over Time")
        ax1.set_xlabel("Review Number")
        ax1.set_ylabel("Quality (1=Wrong, 4=Remembered)")
        ax1.set_ylim(0, 5)
        ax1.grid(True, alpha=0.3)

        # Chart 2: State Distribution
        states = defaultdict(int)
        for record in self.review_history:
            post_state = record["post_state"]
            if post_state["is_new"]:
                states["New"] += 1
            elif post_state["is_learning"]:
                states["Learning"] += 1
            elif post_state["is_graduated"]:
                states["Graduated"] += 1

        ax2.pie(
            states.values(),
            labels=states.keys(),
            autopct="%1.1f%%",
            colors=["lightblue", "orange", "lightgreen"],
        )
        ax2.set_title("Card State Distribution")

        # Chart 3: Interval Progression
        intervals = []
        review_nums = []
        for i, record in enumerate(self.review_history):
            interval = record["post_state"]["interval"]
            if interval < 1440:  # Convert minutes to hours for display
                interval_display = interval / 60
                unit = "hours"
            else:  # Convert to days
                interval_display = interval / 1440
                unit = "days"
            intervals.append(interval_display)
            review_nums.append(i + 1)

        ax3.plot(review_nums, intervals, "bo-", markersize=8, linewidth=2)
        ax3.set_title("Interval Progression")
        ax3.set_xlabel("Review Number")
        ax3.set_ylabel("Next Review Interval")
        ax3.grid(True, alpha=0.3)
        ax3.set_yscale("log")

        # Chart 4: Learning Step Progression
        learning_steps = [r["post_state"]["learning_step"] for r in self.review_history]
        ax4.plot(
            range(1, len(learning_steps) + 1),
            learning_steps,
            "ro-",
            markersize=8,
            linewidth=2,
        )
        ax4.set_title("Learning Step Progression")
        ax4.set_xlabel("Review Number")
        ax4.set_ylabel("Learning Step")
        ax4.grid(True, alpha=0.3)

        plt.tight_layout()
        plt.savefig("spaced_repetition_charts.png", dpi=300, bbox_inches="tight")
        print(f"   💾 Saved progression charts to spaced_repetition_charts.png")

        return fig

    def run_comprehensive_test(self):
        """Run the complete test suite"""
        print("🚀 Starting Comprehensive Spaced Repetition Test")
        print("=" * 60)

        try:
            # Setup
            self.setup_test_data()

            # Test 1: Basic card creation and immediate availability
            print("\n" + "=" * 60)
            print("TEST 1: Card Creation & Immediate Availability")
            print("=" * 60)
            card1 = self.create_test_card(self.test_annotations[0].id, "Test Card 1")

            # Test 2: Review with "Wrong" and check resurfacing
            print("\n" + "=" * 60)
            print("TEST 2: Wrong Answer → Learning State")
            print("=" * 60)
            self.review_card_and_track(card1, 1, "First Wrong Answer")

            # Time travel 2 minutes to make card due again
            self.time_travel(2)

            # Check if card appears in learning cards
            due_cards = SpacedRepetitionService.get_due_cards(self.db, 50)
            learning_cards = due_cards["learning_cards"]
            card_in_learning = any(c.id == card1.id for c in learning_cards)
            print(
                f"   ✅ Card appears in learning_cards after 2 minutes: {card_in_learning}"
            )

            # Test 3: Review with "Remembered"
            print("\n" + "=" * 60)
            print("TEST 3: Remembered Answer → Progression")
            print("=" * 60)
            self.review_card_and_track(card1, 4, "First Remembered Answer")

            # Test 4: Create second card and test different path
            print("\n" + "=" * 60)
            print("TEST 4: Alternative Progression Path")
            print("=" * 60)
            card2 = self.create_test_card(self.test_annotations[1].id, "Test Card 2")
            self.review_card_and_track(card2, 4, "Immediate Success")

            # Test 5: Time travel and continue progression
            print("\n" + "=" * 60)
            print("TEST 5: Extended Progression Simulation")
            print("=" * 60)

            # Continue with card1 (currently learning)
            self.time_travel(1441)  # Travel 1 day + 1 minute
            due_cards = SpacedRepetitionService.get_due_cards(self.db, 50)
            print(
                f"   📊 Cards due after 1 day: New={len(due_cards['new_cards'])}, Learning={len(due_cards['learning_cards'])}, Due={len(due_cards['due_cards'])}"
            )

            # Review cards that are due
            all_due = (
                due_cards["new_cards"]
                + due_cards["learning_cards"]
                + due_cards["due_cards"]
            )
            for card in all_due[:3]:  # Review first 3 due cards
                quality = (
                    4 if card.id % 2 == 0 else 1
                )  # Alternate between success/failure
                review_name = f"Extended Review - Card {card.id}"

                # Find the card object in our database
                db_card = (
                    self.db.query(StudyCard).filter(StudyCard.id == card.id).first()
                )
                if db_card:
                    self.review_card_and_track(db_card, quality, review_name)

            # Test 6: Binary tree progression
            print("\n" + "=" * 60)
            print("TEST 6: Binary Tree Progression Analysis")
            print("=" * 60)
            tree = self.test_binary_progression(depth=3)

            # Generate visualizations
            print("\n" + "=" * 60)
            print("VISUALIZATION: Creating Charts & Graphs")
            print("=" * 60)
            self.visualize_progression_tree(tree)
            self.create_progression_charts()

            # Final statistics
            print("\n" + "=" * 60)
            print("FINAL STATISTICS")
            print("=" * 60)
            print(f"📊 Total cards created: {len(self.cards_created)}")
            print(f"📊 Total reviews performed: {len(self.review_history)}")
            print(f"📊 Total time jumps: {len(self.time_jumps)}")

            # Current system state
            final_due_cards = SpacedRepetitionService.get_due_cards(self.db, 50)
            print(f"📊 Final system state:")
            print(f"   • New cards: {len(final_due_cards['new_cards'])}")
            print(f"   • Learning cards: {len(final_due_cards['learning_cards'])}")
            print(f"   • Due cards: {len(final_due_cards['due_cards'])}")

            # Success rates
            total_reviews = len(self.review_history)
            successful_reviews = sum(
                1 for r in self.review_history if r["quality"] >= 3
            )
            success_rate = (
                (successful_reviews / total_reviews * 100) if total_reviews > 0 else 0
            )
            print(
                f"📊 Success rate: {success_rate:.1f}% ({successful_reviews}/{total_reviews})"
            )

            print("\n" + "=" * 60)
            print("✅ COMPREHENSIVE TEST COMPLETED SUCCESSFULLY!")
            print("📊 Check the generated visualization files:")
            print("   • spaced_repetition_tree.png - Binary progression tree")
            print("   • spaced_repetition_charts.png - Progression statistics")
            print("=" * 60)

        except Exception as e:
            print(f"❌ Test failed with error: {str(e)}")
            import traceback

            traceback.print_exc()
        finally:
            self.db.close()


def main():
    """Main function to run the test"""
    # Ensure we have required packages
    try:
        import matplotlib.pyplot as plt
        import networkx as nx
    except ImportError:
        print("❌ Missing required packages. Please install:")
        print("   pip install matplotlib networkx")
        return

    tester = SpacedRepetitionTester()
    tester.run_comprehensive_test()


if __name__ == "__main__":
    main()
