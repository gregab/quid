import { useState, useMemo } from "react";
import { View, Text, TextInput, FlatList, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ChevronRight, Search } from "lucide-react-native";
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

  const friendBalanceMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const fg of friendGroups) {
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
        <View className="px-5 pb-1.5 pt-5">
          <Text className="text-[11px] font-bold uppercase tracking-[0.12em] text-stone-400 dark:text-stone-500">
            {item.label}
          </Text>
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
          className="flex-row items-center gap-3 border-b border-stone-100 bg-[#faf9f7] px-5 py-3.5 active:bg-stone-50 dark:border-stone-800/60 dark:bg-[#0c0a09] dark:active:bg-stone-900"
        >
          <GroupThumbnail
            patternSeed={group.patternSeed}
            bannerUrl={group.bannerUrl}
          />
          <View className="min-w-0 flex-1">
            <Text
              className="text-[15px] font-semibold text-stone-900 dark:text-white"
              numberOfLines={1}
            >
              {group.name}
            </Text>
          </View>
          <BalanceChip balanceCents={group.balanceCents} />
          <ChevronRight size={15} color="#a8a29e" />
        </Pressable>
      );
    }

    const { contact, balanceCents } = item;
    return (
      <Pressable
        onPress={() =>
          router.push(
            `/(app)/(dashboard)/add-friend-expense?friendId=${contact.userId}`,
          )
        }
        className="flex-row items-center gap-3 border-b border-stone-100 bg-[#faf9f7] px-5 py-3.5 active:bg-stone-50 dark:border-stone-800/60 dark:bg-[#0c0a09] dark:active:bg-stone-900"
      >
        <Avatar imageUrl={contact.avatarUrl} size="lg" />
        <View className="min-w-0 flex-1">
          <Text
            className="text-[15px] font-semibold text-stone-900 dark:text-white"
            numberOfLines={1}
          >
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
    <SafeAreaView className="flex-1 bg-[#faf9f7] dark:bg-[#0c0a09]">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-stone-100 px-4 pb-2.5 pt-1 dark:border-stone-800/60">
        <Pressable
          onPress={() => router.back()}
          className="py-1"
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Cancel"
        >
          <Text className="text-sm text-stone-500 dark:text-stone-400">
            Cancel
          </Text>
        </Pressable>
        <Text className="text-sm font-semibold text-stone-900 dark:text-white">
          Add expense
        </Text>
        {/* Spacer to center title */}
        <View className="w-[52px]" />
      </View>

      {/* Search bar */}
      <View className="mx-4 my-3 flex-row items-center gap-2 rounded-xl bg-stone-100 px-3 py-2.5 dark:bg-stone-800">
        <Search size={16} color="#a8a29e" />
        <TextInput
          className="flex-1 text-[15px] text-stone-900 dark:text-white"
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
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-center text-[15px] text-stone-400 dark:text-stone-500">
            {q ? `No results for "${query}"` : "No groups or friends yet."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={listData}
          keyExtractor={(item) => {
            if (item.kind === "section") return `section-${item.label}`;
            if (item.kind === "group") return `group-${item.group.id}`;
            return `friend-${item.contact.userId}`;
          }}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 40 }}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

function BalanceChip({ balanceCents }: { balanceCents: number }) {
  if (balanceCents === 0) {
    return (
      <Text className="mr-1 text-[11px] font-medium text-stone-400 dark:text-stone-500">
        settled
      </Text>
    );
  }
  return (
    <View className="items-end">
      <Text
        className={`text-[11px] ${
          balanceCents > 0
            ? "text-emerald-600/70 dark:text-emerald-400/70"
            : "text-rose-500/70 dark:text-rose-400/70"
        }`}
      >
        {balanceCents > 0 ? "you are owed" : "you owe"}
      </Text>
      <Text
        className={`text-[13px] font-bold ${
          balanceCents > 0
            ? "text-emerald-600 dark:text-emerald-400"
            : "text-rose-500 dark:text-rose-400"
        }`}
      >
        {formatCents(Math.abs(balanceCents))}
      </Text>
    </View>
  );
}
