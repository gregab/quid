import { useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronLeft, ChevronRight, Search } from "lucide-react-native";
import { useGroups, useContacts } from "../../../lib/queries";
import { GroupThumbnail } from "../../../components/ui/GroupThumbnail";
import { Avatar } from "../../../components/ui/Avatar";
import { formatCents, formatDisplayName } from "../../../lib/queries/shared";
import type { GroupSummary, Contact } from "../../../lib/types";

type ListItem =
  | { kind: "section"; label: string }
  | { kind: "group"; group: GroupSummary }
  | { kind: "friend"; contact: Contact; balanceCents: number };

export default function AddExpensePickerScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: groups } = useGroups();
  const { data: contacts } = useContacts();
  const [query, setQuery] = useState("");

  const q = query.trim().toLowerCase();

  const regularGroups = useMemo(
    () => (groups ?? []).filter((g) => !g.isFriendGroup),
    [groups],
  );

  const friendGroups = useMemo(
    () => (groups ?? []).filter((g) => g.isFriendGroup),
    [groups],
  );

  // Build a map of userId → balanceCents for friend groups
  const friendBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    // For friend groups, we use the group's balanceCents and match by friendName
    // We'll match contacts by cross-referencing the friendGroups list
    for (const fg of friendGroups) {
      // The "friend" in a friend group is identified by friendName
      // We find the matching contact by displayName
      const contact = (contacts ?? []).find(
        (c) => c.displayName === (fg.friendName ?? fg.name),
      );
      if (contact) {
        map.set(contact.userId, fg.balanceCents);
      }
    }
    return map;
  }, [friendGroups, contacts]);

  const filteredGroups = useMemo(
    () =>
      q
        ? regularGroups.filter((g) => g.name.toLowerCase().includes(q))
        : regularGroups,
    [regularGroups, q],
  );

  const filteredContacts = useMemo(
    () =>
      q
        ? (contacts ?? []).filter((c) =>
            c.displayName.toLowerCase().includes(q),
          )
        : (contacts ?? []),
    [contacts, q],
  );

  // Build flat list with section headers
  const listData: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    if (filteredGroups.length > 0) {
      items.push({ kind: "section", label: "Groups" });
      for (const group of filteredGroups) {
        items.push({ kind: "group", group });
      }
    }
    if (filteredContacts.length > 0) {
      items.push({ kind: "section", label: "Friends" });
      for (const contact of filteredContacts) {
        items.push({
          kind: "friend",
          contact,
          balanceCents: friendBalanceMap.get(contact.userId) ?? 0,
        });
      }
    }
    return items;
  }, [filteredGroups, filteredContacts, friendBalanceMap]);

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.kind === "section") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionLabel}>{item.label}</Text>
        </View>
      );
    }

    if (item.kind === "group") {
      const { group } = item;
      return (
        <Pressable
          onPress={() =>
            router.push(`/(app)/groups/${group.id}/add-expense`)
          }
          style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
        >
          <GroupThumbnail
            patternSeed={group.patternSeed}
            bannerUrl={group.bannerUrl}
          />
          <View style={styles.rowInfo}>
            <Text style={styles.rowName} numberOfLines={1}>
              {group.name}
            </Text>
          </View>
          <BalanceChip balanceCents={group.balanceCents} />
          <ChevronRight size={15} color="#a8a29e" />
        </Pressable>
      );
    }

    // kind === "friend"
    const { contact, balanceCents } = item;
    return (
      <Pressable
        onPress={() =>
          router.push(
            `/(app)/(dashboard)/add-friend-expense?friendId=${contact.userId}`,
          )
        }
        style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      >
        <Avatar
          imageUrl={contact.avatarUrl}
          size="lg"
        />
        <View style={styles.rowInfo}>
          <Text style={styles.rowName} numberOfLines={1}>
            {formatDisplayName(contact.displayName)}
          </Text>
        </View>
        <BalanceChip balanceCents={balanceCents} />
        <ChevronRight size={15} color="#a8a29e" />
      </Pressable>
    );
  };

  const isEmpty = listData.length === 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={8}
        >
          <ChevronLeft size={20} color="#78716c" />
          <Text style={styles.backLabel}>Cancel</Text>
        </Pressable>
        <Text style={styles.headerTitle}>Add expense</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Search bar */}
      <View style={styles.searchContainer}>
        <Search size={16} color="#a8a29e" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search groups or friends…"
          placeholderTextColor="#a8a29e"
          value={query}
          onChangeText={setQuery}
          autoFocus
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
      </View>

      {/* List */}
      {isEmpty ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>
            {q ? `No results for "${query}"` : "No groups or friends yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item, index) => {
            if (item.kind === "section") return `section-${item.label}`;
            if (item.kind === "group") return `group-${item.group.id}`;
            return `friend-${item.contact.userId}`;
          }}
          renderItem={renderItem}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </View>
  );
}

function BalanceChip({ balanceCents }: { balanceCents: number }) {
  if (balanceCents === 0) {
    return (
      <Text style={styles.balanceSettled}>settled</Text>
    );
  }
  return (
    <View style={styles.balanceStack}>
      <Text
        style={[
          styles.balanceLabel,
          balanceCents > 0 ? styles.balanceOwedLabel : styles.balanceOweLabel,
        ]}
      >
        {balanceCents > 0 ? "you are owed" : "you owe"}
      </Text>
      <Text
        style={[
          styles.balanceAmount,
          balanceCents > 0 ? styles.balanceOwedAmount : styles.balanceOweAmount,
        ]}
      >
        {formatCents(Math.abs(balanceCents))}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#faf9f7",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e7e5e4",
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  backLabel: {
    fontSize: 14,
    color: "#78716c",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1c1917",
  },
  headerSpacer: {
    width: 60,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 4,
    backgroundColor: "#f5f5f4",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 10 : 8,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#1c1917",
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 6,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: "#a8a29e",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#f5f5f4",
    backgroundColor: "#faf9f7",
  },
  rowPressed: {
    backgroundColor: "#f5f5f4",
  },
  rowInfo: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1c1917",
  },
  balanceSettled: {
    fontSize: 11,
    fontWeight: "500",
    color: "#a8a29e",
    marginRight: 4,
  },
  balanceStack: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    fontSize: 11,
  },
  balanceOwedLabel: {
    color: "rgba(5, 150, 105, 0.7)",
  },
  balanceOweLabel: {
    color: "rgba(244, 63, 94, 0.7)",
  },
  balanceAmount: {
    fontSize: 13,
    fontWeight: "700",
  },
  balanceOwedAmount: {
    color: "#059669",
  },
  balanceOweAmount: {
    color: "#f43f5e",
  },
  listContent: {
    paddingBottom: 24,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 15,
    color: "#a8a29e",
    textAlign: "center",
  },
});
