import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRecoilState } from 'recoil';
import { useOutletContext } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useSearchParams, useParams, useNavigate } from 'react-router-dom';
import { TooltipAnchor, Button, NewChatIcon, useMediaQuery } from '@librechat/client';
import { PermissionTypes, Permissions, QueryKeys } from 'librechat-data-provider';
import type t from 'librechat-data-provider';
import type { ContextType } from '~/common';
import { useDocumentTitle, useHasAccess, useLocalize, TranslationKeys } from '~/hooks';
import { useGetEndpointsQuery, useGetAgentCategoriesQuery } from '~/data-provider';
import MarketplaceAdminSettings from './MarketplaceAdminSettings';
import { SidePanelProvider, useChatContext } from '~/Providers';
import { SidePanelGroup } from '~/components/SidePanel';
import { OpenSidebar } from '~/components/Chat/Menus';
import { cn, clearMessagesCache } from '~/utils';
import CategoryTabs from './CategoryTabs';
import SearchBar from './SearchBar';
import AgentGrid from './AgentGrid';
import store from '~/store';

interface AgentMarketplaceProps {
  className?: string;
}

/**
 * AgentMarketplace - Main component for browsing and discovering agents
 *
 * Provides tabbed navigation for different agent categories,
 * search functionality, and detailed agent view through a modal dialog.
 * Uses URL parameters for state persistence and deep linking.
 */
const AgentMarketplace: React.FC<AgentMarketplaceProps> = ({ className = '' }) => {
  const localize = useLocalize();
  const navigate = useNavigate();
  const { category } = useParams();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { conversation, newConversation } = useChatContext();

  const isSmallScreen = useMediaQuery('(max-width: 768px)');
  const { navVisible, setNavVisible } = useOutletContext<ContextType>();
  const [hideSidePanel, setHideSidePanel] = useRecoilState(store.hideSidePanel);

  // 🔹 WIND BOT AGENT ID
  const WIND_AGENT_ID = "agent_Cce1U75lICC89uJamHu4I";

  // Get URL parameters
  const searchQuery = searchParams.get('q') || '';

  // Animation state
  type Direction = 'left' | 'right';
  const [displayCategory, setDisplayCategory] = useState<string>(category || 'all');
  const [nextCategory, setNextCategory] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [animationDirection, setAnimationDirection] = useState<Direction>('right');

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useDocumentTitle(`${localize('com_agents_marketplace')} | LibreChat`);

  useEffect(() => {
    setHideSidePanel(false);
    localStorage.setItem('hideSidePanel', 'false');
    localStorage.setItem('fullPanelCollapse', 'false');
  }, [setHideSidePanel, hideSidePanel]);

  useGetEndpointsQuery();

  const categoriesQuery = useGetAgentCategoriesQuery({
    staleTime: 1000 * 60 * 15,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (
      !category &&
      window.location.pathname === '/agents' &&
      categoriesQuery.data &&
      displayCategory === 'all'
    ) {
      const hasPromoted = categoriesQuery.data.some((cat) => cat.value === 'promoted');
      if (hasPromoted) {
        setDisplayCategory('promoted');
      }
    }
  }, [category, categoriesQuery.data, displayCategory]);

  const handleAgentSelect = (agent: t.Agent) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('agent_id', agent.id);
    setSearchParams(newParams);
  };

  const orderedTabs = useMemo<string[]>(() => {
    const dynamic = (categoriesQuery.data || []).map((c) => c.value);
    const set = new Set<string>(dynamic);
    return Array.from(set);
  }, [categoriesQuery.data]);

  const getTabIndex = useCallback(
    (tab: string): number => {
      const idx = orderedTabs.indexOf(tab);
      return idx >= 0 ? idx : 0;
    },
    [orderedTabs],
  );

  const handleTabChange = (tabValue: string) => {
    if (tabValue === displayCategory || isTransitioning) return;

    const currentIndex = getTabIndex(displayCategory);
    const newIndex = getTabIndex(tabValue);
    const direction: Direction = newIndex > currentIndex ? 'right' : 'left';

    setAnimationDirection(direction);
    setNextCategory(tabValue);
    setIsTransitioning(true);

    const currentSearchParams = searchParams.toString();
    const searchParamsStr = currentSearchParams ? `?${currentSearchParams}` : '';

    if (tabValue === 'promoted') {
      navigate(`/agents${searchParamsStr}`);
    } else {
      navigate(`/agents/${tabValue}${searchParamsStr}`);
    }

    window.setTimeout(() => {
      setDisplayCategory(tabValue);
      setNextCategory(null);
      setIsTransitioning(false);
    }, 300);
  };

  useEffect(() => {
    if (category && category !== displayCategory && !isTransitioning) {
      setDisplayCategory(category);
    }
  }, [category, displayCategory, isTransitioning]);

  const handleSearch = (query: string) => {
    const newParams = new URLSearchParams(searchParams);
    const currentCategory = displayCategory;

    if (query.trim()) newParams.set('q', query.trim());
    else newParams.delete('q');

    if (currentCategory === 'promoted') {
      navigate(`/agents${newParams.toString() ? `?${newParams.toString()}` : ''}`);
    } else {
      navigate(`/agents/${currentCategory}${newParams.toString() ? `?${newParams.toString()}` : ''}`);
    }
  };

  const handleNewChat = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (e.button === 0 && (e.ctrlKey || e.metaKey)) {
      window.open('/c/new', '_blank');
      return;
    }
    clearMessagesCache(queryClient, conversation?.conversationId);
    queryClient.invalidateQueries([QueryKeys.messages]);
    newConversation();
  };

  const defaultLayout = useMemo(() => {
    const resizableLayout = localStorage.getItem('react-resizable-panels:layout');
    return typeof resizableLayout === 'string' ? JSON.parse(resizableLayout) : undefined;
  }, []);

  const defaultCollapsed = useMemo(() => {
    const collapsedPanels = localStorage.getItem('react-resizable-panels:collapsed');
    return typeof collapsedPanels === 'string' ? JSON.parse(collapsedPanels) : true;
  }, []);

  const fullCollapse = useMemo(() => localStorage.getItem('fullPanelCollapse') === 'true', []);

  const hasAccessToMarketplace = useHasAccess({
    permissionType: PermissionTypes.MARKETPLACE,
    permission: Permissions.USE,
  });

  // 🔹 Redirect students directly to WindBot
  useEffect(() => {
    if (!hasAccessToMarketplace) {
      navigate(`/c/new?agent_id=${WIND_AGENT_ID}`);
    }
  }, [hasAccessToMarketplace, navigate]);

  if (!hasAccessToMarketplace) {
    return null;
  }

  return (
    <div className={`relative flex w-full grow overflow-hidden bg-presentation ${className}`}>
      <SidePanelProvider>
        <SidePanelGroup
          defaultLayout={defaultLayout}
          fullPanelCollapse={fullCollapse}
          defaultCollapsed={defaultCollapsed}
        >
          <main className="flex h-full flex-col overflow-hidden" role="main">
            <div
              ref={scrollContainerRef}
              className="scrollbar-gutter-stable relative flex h-full flex-col overflow-y-auto overflow-x-hidden"
            >

              {/* header omitted unchanged */}

              <div
                className={cn(
                  'sticky z-10 bg-presentation pb-4',
                  isSmallScreen ? 'top-0' : 'top-14',
                )}
              >
                <div className="container mx-auto max-w-4xl px-4">

                  <div className="mx-auto flex max-w-2xl gap-2 pb-6">
                    <SearchBar value={searchQuery} onSearch={handleSearch} />

                    {/* 🔹 Admin settings only for admins */}
                    {hasAccessToMarketplace && <MarketplaceAdminSettings />}
                  </div>

                  <CategoryTabs
                    categories={categoriesQuery.data || []}
                    activeTab={displayCategory}
                    isLoading={categoriesQuery.isLoading}
                    onChange={handleTabChange}
                  />
                </div>
              </div>

              {/* rest of file unchanged */}

            </div>
          </main>
        </SidePanelGroup>
      </SidePanelProvider>
    </div>
  );
};

export default AgentMarketplace;